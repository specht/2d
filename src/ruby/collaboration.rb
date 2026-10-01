require "json"
require "securerandom"
require "thread"

module Collaboration
    class Error < StandardError; end
    class SessionNotFound < Error; end
    class InvalidName < Error; end
    class InvalidParticipant < Error; end
    class InvalidSave < Error; end

    class Store
        DEFAULT_SESSION_TTL = 6 * 60 * 60
        DEFAULT_RECONNECT_GRACE = 60
        MAX_NAME_LENGTH = 40
        COMMAND_KEY = "__collaboration"

        def initialize(clock: -> { Time.now.to_f },
                       session_ttl: DEFAULT_SESSION_TTL,
                       reconnect_grace: DEFAULT_RECONNECT_GRACE,
                       code_generator: -> { SecureRandom.hex(12) },
                       id_generator: -> { SecureRandom.hex(8) })
            @clock = clock
            @session_ttl = session_ttl
            @reconnect_grace = reconnect_grace
            @code_generator = code_generator
            @id_generator = id_generator
            @sessions = {}
            @mutex = Mutex.new
        end

        def create(state:, source_tag: nil)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                code = unique_id(@sessions, @code_generator)
                @sessions[code] = {
                    code: code,
                    source_tag: source_tag,
                    state: deep_copy(state),
                    revision: 0,
                    resource_revisions: {},
                    participants: {},
                    save: nil,
                    created_at: now,
                    last_seen: now,
                }
                snapshot_locked(@sessions[code])
            end
        end

        def join(code:, name:, participant_id: nil)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                display_name = normalize_name(name)

                participant = participant_id && session[:participants][participant_id]
                participant = nil if participant && participant[:connected]
                if participant.nil?
                    participant_id = unique_id(session[:participants], @id_generator)
                    participant = {
                        id: participant_id,
                        name: display_name,
                        connected: false,
                        connection_id: nil,
                        lock: nil,
                        last_seen: now,
                    }
                    session[:participants][participant_id] = participant
                end

                connection_id = @id_generator.call
                participant[:name] = display_name
                participant[:connected] = true
                participant[:connection_id] = connection_id
                participant[:lock] = nil
                participant[:last_seen] = now
                session[:last_seen] = now

                {
                    participant_id: participant_id,
                    connection_id: connection_id,
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

        def touch(code:, participant_id:, connection_id:)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                participant = current_participant_locked(session, participant_id, connection_id)
                participant[:last_seen] = now
                session[:last_seen] = now
                true
            end
        end

        def snapshot(code:)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                snapshot_locked(fetch_session_locked(code))
            end
        end

        def begin_save(code:, participant_id:, connection_id:)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                participant = current_participant_locked(session, participant_id, connection_id)
                participant[:last_seen] = now
                session[:last_seen] = now
                return nil if session[:save]

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
                session[:last_seen] = @clock.call
                snapshot_locked(session)
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

        # replace_state remains the single WebSocket mutation entry point used by
        # the first collaboration client. Ordinary state replacement keeps its
        # optimistic global revision check. Structured collaboration commands are
        # carried in a wrapper that is never written into the saved game JSON.
        def replace_state(code:, participant_id:, connection_id:, base_revision:, state:)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                participant = current_participant_locked(session, participant_id, connection_id)
                participant[:last_seen] = now
                session[:last_seen] = now

                command = state[COMMAND_KEY]
                if command.is_a?(Hash)
                    return apply_command_locked(session, participant, command)
                end

                unless base_revision == session[:revision]
                    return {
                        applied: false,
                        snapshot: snapshot_locked(session),
                    }
                end

                session[:state] = deep_copy(state)
                session[:revision] += 1
                {
                    applied: true,
                    snapshot: snapshot_locked(session),
                }
            end
        end

        def cleanup!
            @mutex.synchronize do
                cleanup_locked(@clock.call)
            end
        end

        private

        def deep_copy(value)
            JSON.parse(JSON.generate(value))
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
                    result[:lock] = deep_copy(participant[:lock]) if participant[:lock]
                    result
                end
                .sort_by { |participant| participant[:id] }
        end

        def snapshot_locked(session)
            {
                code: session[:code],
                source_tag: session[:source_tag],
                revision: session[:revision],
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

        def apply_command_locked(session, participant, command)
            case command["type"]
            when "lock"
                lock_resource_locked(session, participant, command["resource"])
            when "unlock"
                unlock_resource_locked(session, participant, command["resource"])
            when "replace_resource"
                replace_resource_locked(
                    session,
                    participant,
                    command["resource"],
                    command["resource_revision"],
                    command["value"],
                )
            else
                {
                    applied: false,
                    snapshot: snapshot_locked(session),
                }
            end
        end

        def valid_resource_locked?(session, resource)
            return true if resource == "settings"
            match = /\A(sprite|level):(\d+)\z/.match(resource.to_s)
            return false unless match
            collection = match[1] == "sprite" ? session[:state]["sprites"] : session[:state]["levels"]
            collection.is_a?(Array) && match[2].to_i < collection.length
        end

        def resource_revision_locked(session, resource)
            session[:resource_revisions][resource] || 0
        end

        def resource_value_locked(session, resource)
            return session[:state]["properties"] if resource == "settings"
            match = /\A(sprite|level):(\d+)\z/.match(resource)
            collection = match[1] == "sprite" ? session[:state]["sprites"] : session[:state]["levels"]
            collection[match[2].to_i]
        end

        def set_resource_value_locked(session, resource, value)
            if resource == "settings"
                session[:state]["properties"] = deep_copy(value)
                return
            end
            match = /\A(sprite|level):(\d+)\z/.match(resource)
            collection = match[1] == "sprite" ? session[:state]["sprites"] : session[:state]["levels"]
            collection[match[2].to_i] = deep_copy(value)
        end

        def lock_holder_locked(session, resource)
            session[:participants].values.find do |other|
                other[:connected] && other[:lock] && other[:lock][:resource] == resource
            end
        end

        def lock_resource_locked(session, participant, resource)
            unless valid_resource_locked?(session, resource)
                return { applied: false, snapshot: snapshot_locked(session) }
            end

            holder = lock_holder_locked(session, resource)
            if holder && holder[:id] != participant[:id]
                return { applied: false, snapshot: snapshot_locked(session) }
            end

            participant[:lock] = {
                resource: resource,
                revision: resource_revision_locked(session, resource),
            }
            {
                applied: true,
                snapshot: snapshot_locked(session),
            }
        end

        def unlock_resource_locked(session, participant, resource)
            if participant[:lock] && (resource.nil? || participant[:lock][:resource] == resource)
                participant[:lock] = nil
            end
            {
                applied: true,
                snapshot: snapshot_locked(session),
            }
        end

        def replace_resource_locked(session, participant, resource, resource_revision, value)
            unless valid_resource_locked?(session, resource) && value.is_a?(Hash)
                return { applied: false, snapshot: snapshot_locked(session) }
            end
            lock = participant[:lock]
            unless lock && lock[:resource] == resource
                return { applied: false, snapshot: snapshot_locked(session) }
            end
            unless resource_revision.is_a?(Integer) && resource_revision == resource_revision_locked(session, resource)
                return { applied: false, snapshot: snapshot_locked(session) }
            end

            set_resource_value_locked(session, resource, value)
            next_resource_revision = resource_revision + 1
            session[:resource_revisions][resource] = next_resource_revision
            participant[:lock] = {
                resource: resource,
                revision: next_resource_revision,
            }
            session[:revision] += 1
            {
                applied: true,
                snapshot: snapshot_locked(session),
            }
        end
    end
end
