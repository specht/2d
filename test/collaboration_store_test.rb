require "minitest/autorun"
require_relative "../src/ruby/collaboration"

class CollaborationStoreTest < Minitest::Test
    def setup
        @now = 1_000.0
        @ids = %w(session participant-a connection-a participant-b connection-b connection-new extra extra2 extra3 extra4 extra5 extra6 extra7 extra8 extra9)
        @store = Collaboration::Store.new(
            clock: -> { @now },
            session_ttl: 100,
            reconnect_grace: 10,
            code_generator: -> { @ids.shift },
            id_generator: -> { @ids.shift },
        )
        @state = {
            "parent" => "abc1234",
            "properties" => { "title" => "Gemeinsam" },
            "sprites" => [{ "properties" => { "name" => "Held" }, "states" => [] }, { "properties" => { "name" => "Muenze" }, "states" => [] }],
            "levels" => [{ "properties" => { "name" => "Start" }, "layers" => [] }],
        }
    end

    def test_create_keeps_an_independent_copy_and_revision_zero
        created = @store.create(state: @state, source_tag: "abc1234")
        @state["properties"]["title"] = "changed outside"

        assert_equal "session", created[:code]
        assert_equal "abc1234", created[:source_tag]
        assert_equal 0, created[:revision]
        assert_equal "Gemeinsam", created[:state]["properties"]["title"]
        assert_empty created[:participants]
    end

    def test_join_requires_and_normalizes_a_name_but_allows_duplicates
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "  Anna   Maria ")
        ben = @store.join(code: "session", name: "Anna Maria")

        assert_equal "Anna Maria", anna[:snapshot][:participants][0][:name]
        assert_equal %w[Anna\ Maria Anna\ Maria],
            ben[:snapshot][:participants].map { |participant| participant[:name] }
    end

    def test_join_rejects_blank_and_control_character_names
        @store.create(state: @state)

        assert_raises(Collaboration::InvalidName) do
            @store.join(code: "session", name: "   ")
        end
        assert_raises(Collaboration::InvalidName) do
            @store.join(code: "session", name: "Anna\nBen")
        end
    end

    def test_reconnect_reuses_participant_and_old_close_cannot_disconnect_it
        @store.create(state: @state)
        first = @store.join(code: "session", name: "Mia")
        participant_id = first[:participant_id]
        old_connection = first[:connection_id]

        assert @store.leave(
            code: "session",
            participant_id: participant_id,
            connection_id: old_connection,
        )
        reconnected = @store.join(
            code: "session",
            name: "Mia",
            participant_id: participant_id,
        )

        refute_equal old_connection, reconnected[:connection_id]
        refute @store.leave(
            code: "session",
            participant_id: participant_id,
            connection_id: old_connection,
        )
        assert_equal ["Mia"], @store.snapshot(code: "session")[:participants].map { |p| p[:name] }
    end

    def test_same_participant_id_cannot_take_over_an_active_connection
        @store.create(state: @state)
        first = @store.join(code: "session", name: "Mia")
        second = @store.join(
            code: "session",
            name: "Mia",
            participant_id: first[:participant_id],
        )

        refute_equal first[:participant_id], second[:participant_id]
        assert_equal 2, second[:snapshot][:participants].length
    end

    def test_current_connection_can_leave_and_reconnect_within_grace_period
        @store.create(state: @state)
        first = @store.join(code: "session", name: "Mia")

        assert @store.leave(
            code: "session",
            participant_id: first[:participant_id],
            connection_id: first[:connection_id],
        )
        assert_empty @store.snapshot(code: "session")[:participants]

        @now += 5
        second = @store.join(
            code: "session",
            name: "Mia",
            participant_id: first[:participant_id],
        )
        assert_equal first[:participant_id], second[:participant_id]
    end

    def test_replace_state_advances_revision_only_for_current_revision
        @store.create(state: @state)
        joined = @store.join(code: "session", name: "Mia")
        updated = @state.merge("properties" => { "title" => "Version 1" })

        result = @store.replace_state(
            code: "session",
            participant_id: joined[:participant_id],
            connection_id: joined[:connection_id],
            base_revision: 0,
            state: updated,
        )

        assert result[:applied]
        assert_equal 1, result[:snapshot][:revision]
        assert_equal "Version 1", result[:snapshot][:state]["properties"]["title"]
    end

    def test_stale_replace_is_rejected_with_authoritative_snapshot
        @store.create(state: @state)
        joined = @store.join(code: "session", name: "Mia")
        first = @state.merge("properties" => { "title" => "Version 1" })

        @store.replace_state(
            code: "session",
            participant_id: joined[:participant_id],
            connection_id: joined[:connection_id],
            base_revision: 0,
            state: first,
        )

        stale = @store.replace_state(
            code: "session",
            participant_id: joined[:participant_id],
            connection_id: joined[:connection_id],
            base_revision: 0,
            state: @state.merge("properties" => { "title" => "stale" }),
        )

        refute stale[:applied]
        assert_equal 1, stale[:snapshot][:revision]
        assert_equal "Version 1", stale[:snapshot][:state]["properties"]["title"]
    end

    def test_session_expires_after_inactivity
        @store.create(state: @state)
        @now += 101
        @store.cleanup!

        assert_raises(Collaboration::SessionNotFound) do
            @store.snapshot(code: "session")
        end
    end

    def test_disconnected_participant_is_removed_after_reconnect_grace
        @store.create(state: @state)
        joined = @store.join(code: "session", name: "Mia")
        @store.leave(
            code: "session",
            participant_id: joined[:participant_id],
            connection_id: joined[:connection_id],
        )

        @now += 11
        @store.cleanup!
        fresh = @store.join(
            code: "session",
            name: "Mia",
            participant_id: joined[:participant_id],
        )

        refute_equal joined[:participant_id], fresh[:participant_id]
    end

    def command(type, **values)
        { Collaboration::Store::COMMAND_KEY => { "type" => type }.merge(values.transform_keys(&:to_s)) }
    end

    def replace_command(joined, state, base_revision: 0)
        @store.replace_state(
            code: "session",
            participant_id: joined[:participant_id],
            connection_id: joined[:connection_id],
            base_revision: base_revision,
            state: state,
        )
    end

    def test_different_resources_can_be_locked_at_the_same_time
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")

        assert replace_command(anna, command("lock", resource: "sprite:0"))[:applied]
        assert replace_command(ben, command("lock", resource: "level:0"))[:applied]

        participants = @store.snapshot(code: "session")[:participants]
        assert_equal "sprite:0", participants.find { |p| p[:name] == "Anna" }[:lock]["resource"]
        assert_equal "level:0", participants.find { |p| p[:name] == "Ben" }[:lock]["resource"]
    end

    def test_same_resource_lock_is_denied_and_reports_the_holder
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")

        assert replace_command(anna, command("lock", resource: "sprite:0"))[:applied]
        denied = replace_command(ben, command("lock", resource: "sprite:0"))

        refute denied[:applied]
        holder = denied[:snapshot][:participants].find { |p| p[:lock] && p[:lock]["resource"] == "sprite:0" }
        assert_equal "Anna", holder[:name]
    end

    def test_resource_replacement_merges_only_the_locked_resource
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")
        replace_command(anna, command("lock", resource: "sprite:0"))
        replace_command(ben, command("lock", resource: "level:0"))

        sprite = { "properties" => { "name" => "Held neu" }, "states" => [] }
        level = { "properties" => { "name" => "Level neu" }, "layers" => [] }

        first = replace_command(anna, command("replace_resource", resource: "sprite:0", resource_revision: 0, value: sprite))
        second = replace_command(ben, command("replace_resource", resource: "level:0", resource_revision: 0, value: level), base_revision: 0)

        assert first[:applied]
        assert second[:applied], "a change to another locked resource must not make this update stale"
        snapshot = second[:snapshot]
        assert_equal 2, snapshot[:revision]
        assert_equal "Held neu", snapshot[:state]["sprites"][0]["properties"]["name"]
        assert_equal "Level neu", snapshot[:state]["levels"][0]["properties"]["name"]
        assert_equal "Muenze", snapshot[:state]["sprites"][1]["properties"]["name"]
    end

    def test_resource_revision_rejects_a_stale_update_without_dropping_the_lock
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        replace_command(anna, command("lock", resource: "sprite:0"))
        replace_command(anna, command("replace_resource", resource: "sprite:0", resource_revision: 0,
            value: { "properties" => { "name" => "Version 1" }, "states" => [] }))

        stale = replace_command(anna, command("replace_resource", resource: "sprite:0", resource_revision: 0,
            value: { "properties" => { "name" => "stale" }, "states" => [] }), base_revision: 1)

        refute stale[:applied]
        me = stale[:snapshot][:participants].find { |p| p[:name] == "Anna" }
        assert_equal 1, me[:lock]["revision"]
        assert_equal "Version 1", stale[:snapshot][:state]["sprites"][0]["properties"]["name"]
    end

    def test_leave_releases_the_resource_lock_immediately
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        replace_command(anna, command("lock", resource: "sprite:0"))

        @store.leave(code: "session", participant_id: anna[:participant_id], connection_id: anna[:connection_id])
        ben = @store.join(code: "session", name: "Ben")
        acquired = replace_command(ben, command("lock", resource: "sprite:0"))

        assert acquired[:applied]
        assert_equal "Ben", acquired[:snapshot][:participants].find { |p| p[:lock] }[:name]
    end

    def test_only_one_shared_save_can_be_in_progress
        @store.create(state: @state, source_tag: "abc1234")
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")

        first = @store.begin_save(
            code: "session",
            participant_id: anna[:participant_id],
            connection_id: anna[:connection_id],
        )
        second = @store.begin_save(
            code: "session",
            participant_id: ben[:participant_id],
            connection_id: ben[:connection_id],
        )

        refute_nil first
        assert_nil second
        assert_equal anna[:participant_id], first[:participant_id]
        assert_equal "Anna", first[:participant_name]
        assert_equal "abc1234", first[:source_tag]
    end

    def test_shared_save_uses_a_copy_of_the_authoritative_state
        @store.create(state: @state, source_tag: "abc1234")
        anna = @store.join(code: "session", name: "Anna")
        prepared = @store.begin_save(
            code: "session",
            participant_id: anna[:participant_id],
            connection_id: anna[:connection_id],
        )

        prepared[:state]["properties"]["title"] = "mutated by saver"

        assert_equal "Gemeinsam", @store.snapshot(code: "session")[:state]["properties"]["title"]
    end

    def test_finishing_shared_save_updates_lineage_without_losing_newer_session_edits
        @store.create(state: @state, source_tag: "abc1234")
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")
        prepared = @store.begin_save(
            code: "session",
            participant_id: anna[:participant_id],
            connection_id: anna[:connection_id],
        )

        @store.replace_state(
            code: "session",
            participant_id: ben[:participant_id],
            connection_id: ben[:connection_id],
            base_revision: 0,
            state: @state.merge("properties" => { "title" => "nach Save-Klick geändert" }),
        )

        snapshot = @store.finish_save(code: "session", token: prepared[:token], tag: "new1234")

        assert_equal "new1234", snapshot[:source_tag]
        assert_equal "new1234", snapshot[:state]["parent"]
        assert_equal "nach Save-Klick geändert", snapshot[:state]["properties"]["title"]
        assert_equal 2, snapshot[:revision]
    end

    def test_aborting_shared_save_releases_the_save_slot
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")
        prepared = @store.begin_save(
            code: "session",
            participant_id: anna[:participant_id],
            connection_id: anna[:connection_id],
        )

        assert @store.abort_save(code: "session", token: prepared[:token])
        retry_save = @store.begin_save(
            code: "session",
            participant_id: ben[:participant_id],
            connection_id: ben[:connection_id],
        )
        refute_nil retry_save
    end

    def test_finishing_shared_save_rejects_the_wrong_token
        @store.create(state: @state)
        anna = @store.join(code: "session", name: "Anna")
        @store.begin_save(
            code: "session",
            participant_id: anna[:participant_id],
            connection_id: anna[:connection_id],
        )

        assert_raises(Collaboration::InvalidSave) do
            @store.finish_save(code: "session", token: "wrong", tag: "new1234")
        end
    end

    def test_default_session_code_is_six_readable_uppercase_characters
        store = Collaboration::Store.new
        code = store.create(state: @state)[:code]

        assert_match(/\A[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}\z/, code)
    end

end
