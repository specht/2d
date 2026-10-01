require "json"
require "securerandom"
require "thread"

module Collaboration
    class Error < StandardError; end
    class SessionNotFound < Error; end
    class InvalidName < Error; end
    class InvalidParticipant < Error; end

    class Store
        DEFAULT_SESSION_TTL = 6 * 60 * 60
        DEFAULT_RECONNECT_GRACE = 60
        MAX_NAME_LENGTH = 40

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
                    participants: {},
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
                        last_seen: now,
                    }
                    session[:participants][participant_id] = participant
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

        # Foundation protocol for the next editor-integration patch. The first
        # browser UI does not submit state replacements yet. Keeping the
        # revision check here makes stale-write/resync behaviour testable before
        # individual editor operations are wired up.
        def replace_state(code:, participant_id:, connection_id:, base_revision:, state:)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                session = fetch_session_locked(code)
                participant = current_participant_locked(session, participant_id, connection_id)
                participant[:last_seen] = now
                session[:last_seen] = now

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
                .map { |participant| { id: participant[:id], name: participant[:name] } }
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
    end
end
