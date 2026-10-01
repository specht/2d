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
        COLLABORATION_CODE_LENGTH = 6
        COLLABORATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".freeze
        COMMAND_KEY = "__collaboration"

        def initialize(clock: -> { Time.now.to_f },
                       session_ttl: DEFAULT_SESSION_TTL,
                       reconnect_grace: DEFAULT_RECONNECT_GRACE,
                       code_generator: -> {
                           Array.new(COLLABORATION_CODE_LENGTH) {
                               COLLABORATION_CODE_ALPHABET[
                                   SecureRandom.random_number(COLLABORATION_CODE_ALPHABET.length)
                               ]
                           }.join
                       },
                       resource_id_generator: -> { SecureRandom.hex(8) },
                       id_generator: -> { SecureRandom.hex(8) })
            @clock = clock
            @session_ttl = session_ttl
            @reconnect_grace = reconnect_grace
            @code_generator = code_generator
            @resource_id_generator = resource_id_generator
            @id_generator = id_generator
            @sessions = {}
            @mutex = Mutex.new
        end

        def create(state:, source_tag: nil)
            @mutex.synchronize do
                now = @clock.call
                cleanup_locked(now)
                code = unique_id(@sessions, @code_generator)
                copied_state = deep_copy(state)
                @sessions[code] = {
                    code: code,
                    source_tag: source_tag,
                    state: copied_state,
                    revision: 0,
                    structure_revision: 0,
                    resource_ids: build_resource_ids_locked(copied_state),
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
                structure_revision: session[:structure_revision],
                resource_ids: deep_copy(session[:resource_ids]),
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
                    command["sprite_ids"],
                )
            when "insert_resource"
                insert_resource_locked(session, participant, command)
            when "delete_resource"
                delete_resource_locked(session, participant, command)
            when "move_resource"
                move_resource_locked(session, participant, command)
            else
                {
                    applied: false,
                    snapshot: snapshot_locked(session),
                }
            end
        end

        def build_resource_ids_locked(state)
            used = {}
            result = {}
            %w[sprites levels].each do |key|
                count = state[key].is_a?(Array) ? state[key].length : 0
                result[key] = Array.new(count) do
                    id = unique_id(used, @resource_id_generator)
                    used[id] = true
                    id
                end
            end
            result
        end

        def collection_key_for_kind(kind)
            return "sprites" if kind == "sprite"
            return "levels" if kind == "level"
            nil
        end

        def resource_location_locked(session, resource)
            return ["settings", nil, nil] if resource == "settings"
            match = /\A(sprite|level):(.+)\z/.match(resource.to_s)
            return nil unless match
            kind = match[1]
            key = collection_key_for_kind(kind)
            ids = session[:resource_ids][key]
            index = ids.index(match[2])
            if index.nil? && match[2].match?(/\A\d+\z/)
                legacy_index = match[2].to_i
                index = legacy_index if legacy_index < ids.length
            end
            return nil if index.nil?
            [kind, key, index]
        end

        def valid_resource_locked?(session, resource)
            !resource_location_locked(session, resource).nil?
        end

        def resource_revision_locked(session, resource)
            session[:resource_revisions][resource] || 0
        end

        def resource_value_locked(session, resource)
            return session[:state]["properties"] if resource == "settings"
            location = resource_location_locked(session, resource)
            return nil unless location
            _kind, key, index = location
            session[:state][key][index]
        end

        def set_resource_value_locked(session, resource, value)
            if resource == "settings"
                session[:state]["properties"] = deep_copy(value)
                return
            end
            _kind, key, index = resource_location_locked(session, resource)
            session[:state][key][index] = deep_copy(value)
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

        def translate_sprite_index(index, old_ids, new_ids)
            return nil unless index.is_a?(Integer) && index >= 0 && index < old_ids.length
            new_ids.index(old_ids[index])
        end

        def remap_sprite_object_references!(sprite, old_ids, new_ids)
            traits = sprite["traits"]
            return unless traits.is_a?(Hash)

            attacks = [
                traits.dig("melee_attack", "attack"),
                traits.dig("ranged_attack", "attack"),
            ]
            %w[actor baddie].each do |role|
                role_attacks = traits.dig(role, "attacks")
                attacks.concat(role_attacks) if role_attacks.is_a?(Array)
            end
            attacks.compact.each do |attack|
                visual = attack.is_a?(Hash) ? attack["visual"] : nil
                next unless visual.is_a?(Hash)
                %w[hit_sprite_index attack_sprite_index projectile_sprite_index].each do |key|
                    next unless visual[key].is_a?(Integer)
                    translated = translate_sprite_index(visual[key], old_ids, new_ids)
                    translated.nil? ? visual.delete(key) : visual[key] = translated
                end
            end

            drop = traits.dig("baddie", "drop")
            if drop.is_a?(Hash) && drop["sprite_index"].is_a?(Integer)
                translated = translate_sprite_index(drop["sprite_index"], old_ids, new_ids)
                translated.nil? ? traits["baddie"].delete("drop") : drop["sprite_index"] = translated
            end
        end

        def remap_level_sprite_references!(level, old_ids, new_ids)
            layers = level["layers"]
            if layers.is_a?(Array)
                layers.each do |layer|
                    next unless layer.is_a?(Hash) && layer["type"] == "sprites" && layer["sprites"].is_a?(Array)
                    layer["sprites"] = layer["sprites"].filter_map do |entry|
                        next unless entry.is_a?(Array) && entry[0].is_a?(Integer)
                        translated = translate_sprite_index(entry[0], old_ids, new_ids)
                        next if translated.nil?
                        entry[0] = translated
                        entry
                    end
                end
            end

            conditions = level["conditions"]
            return unless conditions.is_a?(Array)
            conditions.each do |condition|
                next unless condition.is_a?(Hash) && condition["type"] == "need_sprite"
                properties = condition["properties"]
                next unless properties.is_a?(Hash) && properties["sprite_index"].is_a?(Integer)
                translated = translate_sprite_index(properties["sprite_index"], old_ids, new_ids)
                translated.nil? ? properties.delete("sprite_index") : properties["sprite_index"] = translated
            end
        end

        def remap_state_sprite_references!(state, old_ids, new_ids)
            (state["sprites"] || []).each do |sprite|
                remap_sprite_object_references!(sprite, old_ids, new_ids) if sprite.is_a?(Hash)
            end
            (state["levels"] || []).each do |level|
                remap_level_sprite_references!(level, old_ids, new_ids) if level.is_a?(Hash)
            end
        end

        def remap_resource_sprite_references!(kind, value, old_ids, new_ids)
            return if old_ids == new_ids
            remap_sprite_object_references!(value, old_ids, new_ids) if kind == "sprite"
            remap_level_sprite_references!(value, old_ids, new_ids) if kind == "level"
        end

        def replace_resource_locked(session, participant, resource, resource_revision, value, client_sprite_ids = nil)
            location = resource_location_locked(session, resource)
            unless location && value.is_a?(Hash)
                return { applied: false, snapshot: snapshot_locked(session) }
            end
            lock = participant[:lock]
            unless lock && lock[:resource] == resource
                return { applied: false, snapshot: snapshot_locked(session) }
            end
            unless resource_revision.is_a?(Integer) && resource_revision == resource_revision_locked(session, resource)
                return { applied: false, snapshot: snapshot_locked(session) }
            end

            copied = deep_copy(value)
            if client_sprite_ids.is_a?(Array) && client_sprite_ids.all? { |id| id.is_a?(String) }
                remap_resource_sprite_references!(location[0], copied, client_sprite_ids, session[:resource_ids]["sprites"])
            end
            set_resource_value_locked(session, resource, copied)
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

        def valid_structure_command_locked?(session, command)
            command["structure_revision"].is_a?(Integer) &&
                command["structure_revision"] == session[:structure_revision] &&
                %w[sprite level].include?(command["kind"]) &&
                command["operation_id"].is_a?(String) &&
                command["operation_id"].length.between?(1, 64)
        end

        def structure_error_locked(session, error)
            { applied: false, error: error, snapshot: snapshot_locked(session) }
        end

        def structure_success_locked(session, participant, command, action)
            session[:structure_revision] += 1
            session[:revision] += 1
            {
                applied: true,
                structure: {
                    "action" => action,
                    "kind" => command["kind"],
                    "id" => command["id"],
                    "operation_id" => command["operation_id"],
                    "participant_id" => participant[:id],
                },
                snapshot: snapshot_locked(session),
            }
        end

        def valid_new_resource_id_locked?(session, id)
            return false unless id.is_a?(String) && id.match?(/\A[a-zA-Z0-9_-]{8,64}\z/)
            !session[:resource_ids].values.flatten.include?(id)
        end

        def insert_resource_locked(session, participant, command)
            return structure_error_locked(session, "stale_structure") unless valid_structure_command_locked?(session, command)
            key = collection_key_for_kind(command["kind"])
            id = command["id"]
            value = command["value"]
            return structure_error_locked(session, "invalid_structure") unless valid_new_resource_id_locked?(session, id) && value.is_a?(Hash)

            session[:state][key] ||= []
            session[:state][key] << deep_copy(value)
            session[:resource_ids][key] << id
            structure_success_locked(session, participant, command, "insert")
        end

        def delete_resource_locked(session, participant, command)
            return structure_error_locked(session, "stale_structure") unless valid_structure_command_locked?(session, command)
            key = collection_key_for_kind(command["kind"])
            id = command["id"]
            index = session[:resource_ids][key].index(id)
            return structure_error_locked(session, "invalid_structure") if index.nil?

            resource = "#{command["kind"]}:#{id}"
            holder = lock_holder_locked(session, resource)
            return structure_error_locked(session, "resource_locked") if holder && holder[:id] != participant[:id]

            old_sprite_ids = session[:resource_ids]["sprites"].dup
            session[:state][key].delete_at(index)
            session[:resource_ids][key].delete_at(index)
            session[:resource_revisions].delete(resource)
            session[:participants].each_value do |other|
                other[:lock] = nil if other[:lock] && other[:lock][:resource] == resource
            end
            if command["kind"] == "sprite"
                remap_state_sprite_references!(session[:state], old_sprite_ids, session[:resource_ids]["sprites"])
            end
            structure_success_locked(session, participant, command, "delete")
        end

        def move_resource_locked(session, participant, command)
            return structure_error_locked(session, "stale_structure") unless valid_structure_command_locked?(session, command)
            key = collection_key_for_kind(command["kind"])
            ids = session[:resource_ids][key]
            from = ids.index(command["id"])
            return structure_error_locked(session, "invalid_structure") if from.nil?

            old_sprite_ids = session[:resource_ids]["sprites"].dup
            value = session[:state][key].delete_at(from)
            id = ids.delete_at(from)
            target = nil
            target = ids.index(command["before_id"]) if command["before_id"].is_a?(String)
            if target.nil? && command["after_id"].is_a?(String)
                after_index = ids.index(command["after_id"])
                target = after_index + 1 if after_index
            end
            target ||= ids.length
            target = [[target, 0].max, ids.length].min

            ids.insert(target, id)
            session[:state][key].insert(target, value)
            if command["kind"] == "sprite"
                remap_state_sprite_references!(session[:state], old_sprite_ids, session[:resource_ids]["sprites"])
            end
            structure_success_locked(session, participant, command, "move")
        end
    end
end
