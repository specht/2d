require "json"
require "securerandom"
require "thread"

# Live collaboration sessions, kept in memory by the Ruby process.
#
# A session starts from one game state and keeps one authoritative copy of it.
# Participants change that copy with small operations:
#
# - lock / unlock a resource ("settings", "sprite:<id>" or "level:<id>");
#   everybody holds at most one lock
# - update: replace a locked resource as a whole (optimistic check against the
#   resource revision)
# - insert / delete / move a sprite or a level
#
# Sprites and levels are addressed by their durable `id` (see
# src/static/game_ids.js), never by array index. References between them are
# stored as IDs too, so no operation ever has to rewrite another resource: a
# deleted sprite simply leaves references that nobody can resolve any more,
# which the studio and the game engine both skip.
#
# Every applied operation increases the session revision by one. Clients apply
# broadcast operations in revision order and ask for a snapshot when they
# notice a gap.
#
# Liveness: a participant that has not been heard from for STALE_AFTER seconds
# (browsers send a heartbeat every 30 s) counts as gone and loses its lock. A
# lock nobody has used for LOCK_LEASE seconds can be taken over by somebody
# else, so a forgotten tab cannot block a sprite for a whole lesson. On joining,
# every participant gets a secret reconnect token; with it, a browser whose
# connection dropped takes over its own participant (and lock) again, even
# before the server noticed that the old connection is gone.
module Collaboration
    class Error < StandardError; end
    class SessionNotFound < Error; end
    class InvalidName < Error; end
    class InvalidParticipant < Error; end
    class InvalidSave < Error; end
    class InvalidGame < Error; end

    class Store
        DEFAULT_SESSION_TTL = 6 * 60 * 60
        DEFAULT_RECONNECT_GRACE = 60
        # Background tabs may send their heartbeat only once a minute.
        DEFAULT_STALE_AFTER = 120
        DEFAULT_LOCK_LEASE = 3 * 60
        MAX_NAME_LENGTH = 40
        COLLABORATION_CODE_LENGTH = 6
        COLLABORATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".freeze
        ID_PATTERN = /\A[A-Za-z0-9_-]{1,64}\z/
        COLLECTIONS = { "sprite" => "sprites", "level" => "levels" }.freeze

        def initialize(clock: -> { Time.now.to_f },
                       session_ttl: DEFAULT_SESSION_TTL,
                       reconnect_grace: DEFAULT_RECONNECT_GRACE,
                       stale_after: DEFAULT_STALE_AFTER,
                       lock_lease: DEFAULT_LOCK_LEASE,
                       code_generator: -> {
                           Array.new(COLLABORATION_CODE_LENGTH) {
                               COLLABORATION_CODE_ALPHABET[
                                   SecureRandom.random_number(COLLABORATION_CODE_ALPHABET.length)
                               ]
                           }.join
                       },
                       id_generator: -> { SecureRandom.hex(8) },
                       token_generator: -> { SecureRandom.urlsafe_base64(24) })
            @clock = clock
            @session_ttl = session_ttl
            @reconnect_grace = reconnect_grace
            @stale_after = stale_after
            @lock_lease = lock_lease
            @token_generator = token_generator
            @code_generator = code_generator
            @id_generator = id_generator
            @sessions = {}
            @mutex = Mutex.new
        end

        def create(state:, source_tag: nil)
            copied_state = deep_copy(state)
            validate_game!(copied_state)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                code = unique_id(@sessions, @code_generator)
                @sessions[code] = {
                    code: code,
                    source_tag: source_tag,
                    state: copied_state,
                    revision: 0,
                    # revision of the last shared save; a higher revision means
                    # there are changes nobody has saved yet
                    saved_revision: 0,
                    resource_revisions: {},
                    participants: {},
                    save: nil,
                    created_at: now,
                    last_seen: now,
                }
                snapshot_locked(@sessions[code])
            end
        end

        # Joins as a new participant, or takes over an existing one when its
        # participant_id and secret reconnect_token are given. Taking over also
        # works while the old connection still counts as connected (it simply
        # stops being valid; replaced_connection_id names it) and keeps the lock.
        def join(code:, name:, participant_id: nil, reconnect_token: nil)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                expire_stale_locked(session, now)
                display_name = normalize_name(name)

                participant = participant_id && session[:participants][participant_id]
                participant = nil unless participant && secure_equal?(participant[:reconnect_token], reconnect_token)
                replaced_connection_id = nil
                if participant.nil?
                    participant_id = unique_id(session[:participants], @id_generator)
                    participant = {
                        id: participant_id,
                        name: display_name,
                        reconnect_token: @token_generator.call,
                        connected: false,
                        connection_id: nil,
                        lock: nil,
                        last_seen: now,
                    }
                    session[:participants][participant_id] = participant
                elsif participant[:connected]
                    replaced_connection_id = participant[:connection_id]
                end

                connection_id = @id_generator.call
                participant[:name] = display_name
                participant[:connected] = true
                participant[:connection_id] = connection_id
                participant[:last_seen] = now
                session[:last_seen] = now

                {
                    participant_id: participant_id,
                    connection_id: connection_id,
                    reconnect_token: participant[:reconnect_token],
                    replaced_connection_id: replaced_connection_id,
                    snapshot: snapshot_locked(session),
                }
            end
        end

        def leave(code:, participant_id:, connection_id:)
            @mutex.synchronize do
                session = @sessions[code]
                return false unless session

                participant = session[:participants][participant_id]
                return false unless participant
                return false unless participant[:connection_id] == connection_id

                now = @clock.call
                participant[:connected] = false
                participant[:lock] = nil
                participant[:last_seen] = now
                session[:last_seen] = now
                true
            end
        end

        # Heartbeat. Also notices participants that have gone silent; then
        # expired is true and the others should get the new participant list.
        def touch(code:, participant_id:, connection_id:)
            with_participant(code, participant_id, connection_id) do |session, _participant, expired|
                { expired: expired, participants: participants_locked(session) }
            end
        end

        def snapshot(code:)
            @mutex.synchronize do
                cleanup_locked(@clock.call)
                snapshot_locked(fetch_session_locked(code))
            end
        end

        def participants(code:)
            @mutex.synchronize do
                session = @sessions[code]
                session ? participants_locked(session) : []
            end
        end

        # ------------------------------------------------------------ locks

        def lock(code:, participant_id:, connection_id:, resource:)
            with_participant(code, participant_id, connection_id) do |session, participant|
                now = @clock.call
                holder = lock_holder_locked(session, resource)
                reason = nil
                if holder && holder[:id] != participant[:id]
                    # A lock unused for longer than the lease can be taken over.
                    if now - holder[:lock][:active_at] > @lock_lease
                        holder[:lock] = nil
                    else
                        reason = "locked"
                    end
                end
                reason = "unknown_resource" if resource_target_locked(session, resource).nil?
                if reason.nil? && !(participant[:lock] && participant[:lock][:resource] == resource)
                    participant[:lock] = { resource: resource, active_at: now }
                end
                result = { applied: reason.nil?, participants: participants_locked(session) }
                result[:reason] = reason unless reason.nil?
                result
            end
        end

        def unlock(code:, participant_id:, connection_id:, resource: nil)
            with_participant(code, participant_id, connection_id) do |session, participant|
                lock = participant[:lock]
                participant[:lock] = nil if lock && (resource.nil? || lock[:resource] == resource)
                { applied: true, participants: participants_locked(session) }
            end
        end

        # ----------------------------------------------------------- update

        def update(code:, participant_id:, connection_id:, resource:, resource_revision:, value:)
            with_participant(code, participant_id, connection_id) do |session, participant|
                target = resource_target_locked(session, resource)
                reject = lambda do |reason|
                    {
                        applied: false,
                        reason: reason,
                        resource: resource,
                        resource_revision: target ? resource_revision_locked(session, resource) : nil,
                        value: target ? deep_copy(resource_value_locked(session, target)) : nil,
                    }
                end
                next reject.call("unknown_resource") if target.nil?
                next reject.call("invalid") unless value.is_a?(Hash)
                lock = participant[:lock]
                next reject.call("not_locked") unless lock && lock[:resource] == resource
                next reject.call("stale") unless resource_revision == resource_revision_locked(session, resource)

                copied = deep_copy(value)
                if target[:key] == "properties"
                    session[:state]["properties"] = copied
                else
                    copied["id"] = target[:id]
                    session[:state][target[:key]][target[:index]] = copied
                end
                next_revision = resource_revision + 1
                session[:resource_revisions][resource] = next_revision
                session[:revision] += 1
                lock[:active_at] = @clock.call
                {
                    applied: true,
                    revision: session[:revision],
                    resource: resource,
                    resource_revision: next_revision,
                    value: deep_copy(copied),
                }
            end
        end

        # -------------------------------------------------------- structure

        # Inserts a new sprite or level after `after_id` (nil: at the start).
        # An unknown after_id appends at the end, so an insert is never lost.
        def insert(code:, participant_id:, connection_id:, kind:, value:, after_id: nil)
            with_participant(code, participant_id, connection_id) do |session, participant|
                key = COLLECTIONS[kind]
                id = value.is_a?(Hash) ? value["id"] : nil
                unless key && valid_id?(id) && index_of_locked(session, key, id).nil?
                    next structure_rejection(kind, "insert", id, "invalid")
                end
                list = session[:state][key]
                if after_id.nil?
                    position = 0
                else
                    anchor = index_of_locked(session, key, after_id)
                    position = anchor.nil? ? list.length : anchor + 1
                end
                copied = deep_copy(value)
                list.insert(position, copied)
                session[:resource_revisions]["#{kind}:#{id}"] = 0
                structure_success(session, participant, kind, "insert", id, after_id, deep_copy(copied))
            end
        end

        # Deletes a sprite or level. Not allowed while somebody else has it
        # locked, and never for the last one (the studio would recreate it).
        def delete(code:, participant_id:, connection_id:, kind:, id:)
            with_participant(code, participant_id, connection_id) do |session, participant|
                key = COLLECTIONS[kind]
                index = key && index_of_locked(session, key, id)
                next structure_rejection(kind, "delete", id, "unknown_resource") if index.nil?
                next structure_rejection(kind, "delete", id, "last_item") if session[:state][key].length <= 1
                resource = "#{kind}:#{id}"
                holder = lock_holder_locked(session, resource)
                if holder && holder[:id] != participant[:id]
                    next structure_rejection(kind, "delete", id, "locked")
                end

                session[:state][key].delete_at(index)
                session[:resource_revisions].delete(resource)
                session[:participants].each_value do |other|
                    other[:lock] = nil if other[:lock] && other[:lock][:resource] == resource
                end
                structure_success(session, participant, kind, "delete", id, nil, nil)
            end
        end

        # Moves a sprite or level directly after `after_id` (nil: to the start).
        def move(code:, participant_id:, connection_id:, kind:, id:, after_id: nil)
            with_participant(code, participant_id, connection_id) do |session, participant|
                key = COLLECTIONS[kind]
                from = key && index_of_locked(session, key, id)
                next structure_rejection(kind, "move", id, "unknown_resource") if from.nil?
                if !after_id.nil? && (after_id == id || index_of_locked(session, key, after_id).nil?)
                    next structure_rejection(kind, "move", id, "unknown_resource")
                end

                list = session[:state][key]
                item = list.delete_at(from)
                position = after_id.nil? ? 0 : index_of_locked(session, key, after_id) + 1
                list.insert(position, item)
                structure_success(session, participant, kind, "move", id, after_id, nil)
            end
        end

        # ------------------------------------------------------------- save

        def begin_save(code:, participant_id:, connection_id:)
            with_participant(code, participant_id, connection_id) do |session, participant|
                next nil if session[:save]

                token = @id_generator.call
                session[:save] = {
                    token: token,
                    participant_id: participant[:id],
                }
                {
                    token: token,
                    state: deep_copy(session[:state]),
                    source_tag: session[:source_tag],
                    revision: session[:revision],
                    participant_id: participant[:id],
                    participant_name: participant[:name],
                }
            end
        end

        def finish_save(code:, token:, tag:)
            @mutex.synchronize do
                session = fetch_session_locked(code)
                save = session[:save]
                unless save && save[:token] == token && tag.is_a?(String) && !tag.empty?
                    raise InvalidSave, "invalid_save"
                end

                session[:save] = nil
                session[:source_tag] = tag
                session[:state]["parent"] = tag
                session[:revision] += 1
                session[:saved_revision] = session[:revision]
                session[:last_seen] = @clock.call
                {
                    source_tag: tag,
                    revision: session[:revision],
                    participants: participants_locked(session),
                }
            end
        end

        def abort_save(code:, token:)
            @mutex.synchronize do
                session = @sessions[code]
                return false unless session
                save = session[:save]
                return false unless save && save[:token] == token

                session[:save] = nil
                session[:last_seen] = @clock.call
                true
            end
        end

        def cleanup!
            @mutex.synchronize do
                cleanup_locked(@clock.call)
            end
        end

        private

        def with_participant(code, participant_id, connection_id)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                expired = expire_stale_locked(session, now)
                participant = current_participant_locked(session, participant_id, connection_id)
                participant[:last_seen] = now
                session[:last_seen] = now
                yield session, participant, expired
            end
        end

        # Connected participants that have not been heard from for too long
        # count as gone: they lose their lock, and their reconnect grace starts
        # now. Returns true if anybody expired.
        def expire_stale_locked(session, now)
            expired = false
            session[:participants].each_value do |participant|
                next unless participant[:connected] && now - participant[:last_seen] > @stale_after
                participant[:connected] = false
                participant[:connection_id] = nil
                participant[:lock] = nil
                participant[:last_seen] = now
                expired = true
            end
            expired
        end

        def secure_equal?(expected, given)
            return false unless expected.is_a?(String) && given.is_a?(String) && expected.bytesize == given.bytesize
            result = 0
            expected.bytes.zip(given.bytes) { |a, b| result |= a ^ b }
            result.zero?
        end

        def deep_copy(value)
            JSON.parse(JSON.generate(value))
        end

        def valid_id?(id)
            id.is_a?(String) && ID_PATTERN.match?(id)
        end

        def validate_game!(state)
            raise InvalidGame, "invalid_game" unless state.is_a?(Hash)
            unless state["properties"].nil? || state["properties"].is_a?(Hash)
                raise InvalidGame, "invalid_game"
            end
            COLLECTIONS.each_value do |key|
                list = state[key]
                raise InvalidGame, "invalid_game" unless list.is_a?(Array) && !list.empty?
                ids = list.map { |item| item.is_a?(Hash) ? item["id"] : nil }
                raise InvalidGame, "invalid_game" unless ids.all? { |id| valid_id?(id) } && ids.uniq.length == ids.length
            end
        end

        def normalize_name(name)
            raw = name.to_s
            raise InvalidName, "invalid_name" if raw.match?(/[\u0000-\u001f\u007f]/)
            value = raw.strip.gsub(/\s+/, " ")
            raise InvalidName, "name_required" if value.empty?
            raise InvalidName, "name_too_long" if value.length > MAX_NAME_LENGTH
            value
        end

        def unique_id(collection, generator)
            100.times do
                value = generator.call
                return value unless collection.key?(value)
            end
            raise Error, "could_not_generate_unique_id"
        end

        def fetch_session_locked(code)
            @sessions[code] || raise(SessionNotFound, "session_not_found")
        end

        def current_participant_locked(session, participant_id, connection_id)
            participant = session[:participants][participant_id]
            unless participant &&
                   participant[:connected] &&
                   participant[:connection_id] == connection_id
                raise InvalidParticipant, "invalid_participant"
            end
            participant
        end

        def participants_locked(session)
            session[:participants].values
                .select { |participant| participant[:connected] }
                .map do |participant|
                    result = { id: participant[:id], name: participant[:name] }
                    result[:lock] = { resource: participant[:lock][:resource] } if participant[:lock]
                    result
                end
                .sort_by { |participant| participant[:id] }
        end

        def snapshot_locked(session)
            {
                code: session[:code],
                source_tag: session[:source_tag],
                revision: session[:revision],
                saved_revision: session[:saved_revision],
                resource_revisions: session[:resource_revisions].dup,
                state: deep_copy(session[:state]),
                participants: participants_locked(session),
            }
        end

        def cleanup_locked(now)
            @sessions.delete_if do |_code, session|
                session[:participants].delete_if do |_participant_id, participant|
                    !participant[:connected] &&
                        now - participant[:last_seen] > @reconnect_grace
                end

                now - session[:last_seen] > @session_ttl
            end
        end

        def index_of_locked(session, key, id)
            return nil unless valid_id?(id)
            list = session[:state][key]
            return nil unless list.is_a?(Array)
            list.index { |item| item.is_a?(Hash) && item["id"] == id }
        end

        # { key: "properties" } for the settings, or { key:, index:, id: } for
        # a sprite or level that currently exists; nil otherwise.
        def resource_target_locked(session, resource)
            return { key: "properties" } if resource == "settings"
            match = /\A(sprite|level):(.+)\z/.match(resource.to_s)
            return nil unless match
            key = COLLECTIONS[match[1]]
            index = index_of_locked(session, key, match[2])
            index.nil? ? nil : { key: key, index: index, id: match[2] }
        end

        def resource_value_locked(session, target)
            return session[:state]["properties"] if target[:key] == "properties"
            session[:state][target[:key]][target[:index]]
        end

        def resource_revision_locked(session, resource)
            session[:resource_revisions][resource] || 0
        end

        def lock_holder_locked(session, resource)
            session[:participants].values.find do |other|
                other[:connected] && other[:lock] && other[:lock][:resource] == resource
            end
        end

        def structure_rejection(kind, action, id, reason)
            { applied: false, reason: reason, kind: kind, action: action, id: id }
        end

        def structure_success(session, participant, kind, action, id, after_id, value)
            session[:revision] += 1
            key = COLLECTIONS[kind]
            result = {
                applied: true,
                revision: session[:revision],
                kind: kind,
                action: action,
                id: id,
                after_id: after_id,
                order: session[:state][key].map { |item| item["id"] },
                participant_id: participant[:id],
                participants: participants_locked(session),
            }
            result[:value] = value unless value.nil?
            result
        end
    end
end
