require "fileutils"
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
#
# A copy of oneself that is left behind (an old tab, the computer next door)
# can be removed by a participant with the same name (remove): it loses its
# lock and its reconnect token at once. Only the same name – nobody can throw
# somebody else out. The session remembers it: a join that brings the removed
# participant's id is refused ("removed"), so its tab cannot come back by
# itself (an old tab reconnects on its own); joining anew with a name works.
#
# Sessions live in memory. persist_to/restore_from write them to a private file
# and read them back, so a server restart (a deploy, for example) does not end
# them: after the restart everybody reconnects with their token.
module Collaboration
    class Error < StandardError; end
    class SessionNotFound < Error; end
    class InvalidName < Error; end
    class InvalidParticipant < Error; end
    class InvalidSave < Error; end
    class InvalidGame < Error; end
    class TooManySessions < Error; end
    class SessionFull < Error; end
    class TooManyAttempts < Error; end
    class ParticipantRemoved < Error; end

    # Counts failed attempts (wrong session codes) per client and blocks a
    # client that keeps guessing. Generous on purpose: a whole school may share
    # one IP address, and children mistype codes.
    class AttemptLimiter
        def initialize(clock: -> { Time.now.to_f }, max_failures: 60, window: 10 * 60)
            @clock = clock
            @max_failures = max_failures
            @window = window
            @failures = {}
            @mutex = Mutex.new
        end

        def blocked?(key)
            @mutex.synchronize do
                prune_locked(key)
                (@failures[key] || []).length >= @max_failures
            end
        end

        def failure!(key)
            @mutex.synchronize do
                prune_locked(key)
                (@failures[key] ||= []) << @clock.call
                # keep the table small
                @failures.delete_if { |_key, times| times.empty? } if @failures.size > 10_000
            end
        end

        private

        def prune_locked(key)
            times = @failures[key]
            return unless times
            limit = @clock.call - @window
            times.shift while times.first && times.first < limit
            @failures.delete(key) if times.empty?
        end
    end

    class Store
        DEFAULT_SESSION_TTL = 6 * 60 * 60
        DEFAULT_RECONNECT_GRACE = 60
        # Background tabs may send their heartbeat only once a minute.
        DEFAULT_STALE_AFTER = 120
        DEFAULT_LOCK_LEASE = 3 * 60
        DEFAULT_MAX_SESSIONS = 200
        # Sessions one client address may have open at the same time. A whole
        # school may share one address, so this is generous.
        DEFAULT_MAX_SESSIONS_PER_CREATOR = 60
        DEFAULT_MAX_PARTICIPANTS = 40
        # Every participant gets one of these colours (an index; the studio
        # knows the actual colours) for as long as the participant exists.
        COLOR_COUNT = 8
        PERSISTENCE_VERSION = 1
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
                       max_sessions: DEFAULT_MAX_SESSIONS,
                       max_sessions_per_creator: DEFAULT_MAX_SESSIONS_PER_CREATOR,
                       max_participants: DEFAULT_MAX_PARTICIPANTS,
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
            @max_sessions = max_sessions
            @max_sessions_per_creator = max_sessions_per_creator
            @max_participants = max_participants
            # code => [fingerprint, json] of the last persisted version of each
            # session; only changed sessions are serialized again.
            @persist_cache = {}
            @persist_mutex = Mutex.new
            @token_generator = token_generator
            @code_generator = code_generator
            @id_generator = id_generator
            @sessions = {}
            @mutex = Mutex.new
        end

        # creator identifies the client (its address); it is only used to limit
        # how many sessions one client keeps open, and never written to disk.
        def create(state:, source_tag: nil, creator: nil)
            copied_state = deep_copy(state)
            validate_game!(copied_state)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                raise TooManySessions, "too_many_sessions" if @sessions.size >= @max_sessions
                if creator && @sessions.values.count { |session| session[:creator] == creator } >= @max_sessions_per_creator
                    raise TooManySessions, "too_many_sessions"
                end
                code = unique_id(@sessions, @code_generator)
                @sessions[code] = {
                    code: code,
                    creator: creator,
                    source_tag: source_tag,
                    state: copied_state,
                    revision: 0,
                    # revision of the last shared save; a higher revision means
                    # there are changes nobody has saved yet
                    saved_revision: 0,
                    resource_revisions: {},
                    participants: {},
                    # ids of participants removed as copies (remove): never back by themselves
                    removed: [],
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
                raise ParticipantRemoved, "removed" if participant_id && (session[:removed] || []).include?(participant_id)

                participant = participant_id && session[:participants][participant_id]
                participant = nil unless participant && secure_equal?(participant[:reconnect_token], reconnect_token)
                replaced_connection_id = nil
                if participant.nil?
                    connected = session[:participants].values.count { |other| other[:connected] }
                    raise SessionFull, "session_full" if connected >= @max_participants
                    participant_id = unique_id(session[:participants], @id_generator)
                    participant = {
                        id: participant_id,
                        name: display_name,
                        reconnect_token: @token_generator.call,
                        color: next_color_locked(session),
                        joined: (session[:joined_count] = session[:joined_count].to_i + 1),
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

        # Removes another participant with one's own name – a copy of oneself
        # left in an old tab or on another computer, still listed, maybe with
        # the lock one needs. It is gone at once with its lock and its
        # reconnect token (it cannot come back as itself). Returns { removed:,
        # reason:, participants: }; reason "unknown_participant", "self" or
        # "not_same_name" when nothing was removed.
        def remove(code:, participant_id:, connection_id:, target_id:)
            with_participant(code, participant_id, connection_id) do |session, participant|
                target = target_id.is_a?(String) ? session[:participants][target_id] : nil
                reason = if target.nil? || !target[:connected]
                    "unknown_participant"
                elsif target[:id] == participant[:id]
                    "self"
                elsif target[:name].to_s.downcase != participant[:name].to_s.downcase
                    "not_same_name"
                end
                if reason.nil?
                    session[:participants].delete(target[:id])
                    (session[:removed] ||= []) << target[:id]
                    session[:removed] = session[:removed].last(200)
                end
                { removed: reason.nil?, reason: reason, participants: participants_locked(session) }
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

        # The game a session works on (its last saved version), without a copy
        # of the state: playtesting asks often (main.rb playtest_session_tag).
        def source_tag(code:)
            @mutex.synchronize { @sessions[code]&.dig(:source_tag) }
        end

        # The live sessions for the moderation page (playtesting.rb
        # class_view): the game each works on and who is in it. key: the
        # code, used on the server only (the page never sees a code).
        def summaries
            @mutex.synchronize do
                @sessions.map do |code, session|
                    title = session[:state].is_a?(Hash) ? session[:state].dig("properties", "title").to_s : ""
                    { key: code, source_tag: session[:source_tag], title: title,
                      names: participants_locked(session).map { |participant| participant[:name] } }
                end
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
                    # what the saved copy contains (finish_save)
                    revision: session[:revision],
                }
                {
                    token: token,
                    state: deep_copy(session[:state]),
                    source_tag: session[:source_tag],
                    revision: session[:revision],
                    # nothing happened since the last shared save of this
                    # session (not the game it started from: that may differ)
                    unchanged: session[:saved_revision] > 0 && session[:saved_revision] == session[:revision] && !session[:source_tag].nil?,
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
                # a change that came in while the copy was being written is
                # not in it: it stays unsaved (and the next save is no repeat)
                changed_meanwhile = !save[:revision].nil? && session[:revision] != save[:revision]
                session[:revision] += 1
                session[:saved_revision] = changed_meanwhile ? save[:revision] : session[:revision]
                session[:last_seen] = @clock.call
                {
                    source_tag: tag,
                    revision: session[:revision],
                    saved_revision: session[:saved_revision],
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

        # ------------------------------------------------------ persistence

        # Writes all sessions to path (atomically, readable only by the
        # server). Skipped if nothing changed since the last write. Each session
        # is serialized on its own while holding the lock, and only when it
        # changed, so other sessions are not held up by a large game. The file
        # holds the reconnect tokens: it must never be served to browsers.
        def persist_to(path, force: false)
            @persist_mutex.synchronize do
                codes = @mutex.synchronize do
                    cleanup_locked(@clock.call)
                    @sessions.keys.sort
                end
                changed = force || codes != @persist_cache.keys.sort
                cache = {}
                codes.each do |code|
                    entry = @mutex.synchronize do
                        session = @sessions[code]
                        if session
                            fingerprint = persist_fingerprint(session)
                            cached = @persist_cache[code]
                            if cached && cached[0] == fingerprint
                                cached
                            else
                                [fingerprint, JSON.generate(persistable_session(session))]
                            end
                        end
                    end
                    next if entry.nil? # ended in the meantime
                    changed ||= !@persist_cache[code].equal?(entry)
                    cache[code] = entry
                end
                changed ||= cache.size != codes.size
                next false unless changed

                data = "{\"version\":#{PERSISTENCE_VERSION},\"sessions\":[#{cache.values.map(&:last).join(",")}]}"
                FileUtils.mkdir_p(File.dirname(path))
                temporary = "#{path}.#{Process.pid}.tmp"
                File.open(temporary, "w", 0o600) { |f| f.write(data) }
                File.rename(temporary, path)
                @persist_cache = cache
                true
            end
        end

        # Reads sessions written by persist_to. Every participant starts out
        # disconnected (their reconnect grace starts now) and without a lock.
        # Returns the number of restored sessions.
        def restore_from(path)
            return 0 unless File.exist?(path)
            data = JSON.parse(File.read(path), symbolize_names: false)
            return 0 unless data.is_a?(Hash) && data["version"] == PERSISTENCE_VERSION
            @mutex.synchronize do
                now = @clock.call
                Array(data["sessions"]).each do |raw|
                    session = restore_session(raw, now)
                    @sessions[session[:code]] = session if session && !@sessions.key?(session[:code])
                end
                cleanup_locked(now)
                @sessions.size
            end
        rescue JSON::ParserError, TypeError, NoMethodError, KeyError
            0
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

        # Everything persist_to writes that can change; last_seen is left out
        # on purpose (it changes with every heartbeat).
        def persist_fingerprint(session)
            [
                session[:revision], session[:saved_revision], session[:source_tag],
                session[:participants].map { |id, p| [id, p[:name], p[:reconnect_token]] }.sort,
                session[:removed] || [],
            ]
        end

        def persistable_session(session)
            session.reject { |key, _value| key == :creator }.merge(
                save: nil,
                participants: session[:participants].transform_values { |p| p.merge(lock: nil, connected: false, connection_id: nil) },
            )
        end

        def restore_session(raw, now)
            return nil unless raw.is_a?(Hash) && raw["code"].is_a?(String) && raw["state"].is_a?(Hash)
            participants = {}
            (raw["participants"] || {}).each do |id, p|
                next unless p.is_a?(Hash) && p["reconnect_token"].is_a?(String)
                participants[id] = {
                    id: id,
                    name: p["name"].to_s,
                    reconnect_token: p["reconnect_token"],
                    color: p["color"].is_a?(Integer) ? p["color"] : nil,
                    joined: p["joined"].to_i,
                    connected: false,
                    connection_id: nil,
                    lock: nil,
                    last_seen: now,
                }
            end
            session = {
                code: raw["code"],
                source_tag: raw["source_tag"],
                state: raw["state"],
                revision: raw["revision"].to_i,
                saved_revision: raw["saved_revision"].to_i,
                resource_revisions: (raw["resource_revisions"] || {}).transform_values(&:to_i),
                participants: participants,
                removed: Array(raw["removed"]).select { |id| id.is_a?(String) }.last(200),
                joined_count: [raw["joined_count"].to_i, participants.values.map { |p| p[:joined] }.max.to_i].max,
                save: nil,
                created_at: raw["created_at"].to_f,
                last_seen: raw["last_seen"].to_f,
            }
            participants.each_value { |p| p[:color] ||= next_color_locked(session) }
            session
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
                .sort_by { |participant| [participant[:joined].to_i, participant[:id]] }
                .map do |participant|
                    result = { id: participant[:id], name: participant[:name], color: participant[:color] }
                    result[:lock] = { resource: participant[:lock][:resource] } if participant[:lock]
                    result
                end
        end

        # The colour fewest participants of this session have (those who
        # just lost their connection still count, so they keep theirs).
        def next_color_locked(session)
            counts = Array.new(COLOR_COUNT, 0)
            session[:participants].each_value do |participant|
                color = participant[:color]
                counts[color] += 1 if color.is_a?(Integer) && color.between?(0, COLOR_COUNT - 1)
            end
            counts.index(counts.min)
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
