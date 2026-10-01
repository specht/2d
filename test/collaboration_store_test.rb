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
            "sprites" => [
                { "id" => "held", "properties" => { "name" => "Held" }, "states" => [] },
                { "id" => "muenze", "properties" => { "name" => "Muenze" }, "states" => [] },
            ],
            "levels" => [{ "id" => "start", "properties" => { "name" => "Start" }, "layers" => [] }],
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

        @store.lock(**ids(ben), resource: "settings")
        @store.update(**ids(ben), resource: "settings", resource_revision: 0,
            value: { "title" => "nach Save-Klick geändert" })

        saved = @store.finish_save(code: "session", token: prepared[:token], tag: "new1234")
        snapshot = @store.snapshot(code: "session")

        assert_equal "new1234", saved[:source_tag]
        assert_equal 2, saved[:revision]
        assert_equal "new1234", snapshot[:state]["parent"]
        assert_equal "nach Save-Klick geändert", snapshot[:state]["properties"]["title"]
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


    # ---------------------------------------------------------------- helpers

    def ids(joined)
        { code: "session", participant_id: joined[:participant_id], connection_id: joined[:connection_id] }
    end

    def session_with(*names)
        @store.create(state: @state)
        names.map { |name| @store.join(code: "session", name: name) }
    end

    def state
        @store.snapshot(code: "session")[:state]
    end

    def order(key)
        state[key].map { |item| item["id"] }
    end

    # ------------------------------------------------------------------ create

    def test_create_requires_ids_for_every_sprite_and_level
        missing = @state.merge("sprites" => [{ "states" => [] }])
        duplicate = @state.merge("levels" => [{ "id" => "x" }, { "id" => "x" }])
        empty = @state.merge("levels" => [])

        [missing, duplicate, empty, "not a game"].each do |game|
            assert_raises(Collaboration::InvalidGame) { @store.create(state: game) }
        end
    end

    # ------------------------------------------------------------------- locks

    def test_different_resources_can_be_locked_at_the_same_time
        anna, ben = session_with("Anna", "Ben")

        assert @store.lock(**ids(anna), resource: "sprite:held")[:applied]
        result = @store.lock(**ids(ben), resource: "level:start")

        assert result[:applied]
        locks = result[:participants].to_h { |p| [p[:name], p[:lock][:resource]] }
        assert_equal({ "Anna" => "sprite:held", "Ben" => "level:start" }, locks)
    end

    def test_same_resource_lock_is_denied_and_reports_the_holder
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")

        denied = @store.lock(**ids(ben), resource: "sprite:held")

        refute denied[:applied]
        assert_equal "locked", denied[:reason]
        holder = denied[:participants].find { |p| p[:lock] && p[:lock][:resource] == "sprite:held" }
        assert_equal "Anna", holder[:name]
    end

    def test_unknown_resources_cannot_be_locked
        anna, = session_with("Anna")

        %w[sprite:nope level:held sprite:0 something].each do |resource|
            result = @store.lock(**ids(anna), resource: resource)
            refute result[:applied], resource
            assert_equal "unknown_resource", result[:reason]
        end
    end

    def test_a_participant_holds_one_lock_at_a_time
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @store.lock(**ids(anna), resource: "sprite:muenze")

        assert @store.lock(**ids(ben), resource: "sprite:held")[:applied]
    end

    def test_leave_releases_the_resource_lock_immediately
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")

        @store.leave(**ids(anna))

        assert @store.lock(**ids(ben), resource: "sprite:held")[:applied]
    end

    # ------------------------------------------------------------------ update

    def test_update_replaces_only_the_locked_resource_and_keeps_its_id
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @store.lock(**ids(ben), resource: "level:start")

        first = @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0,
            value: { "id" => "forged", "properties" => { "name" => "Held neu" }, "states" => [] })
        second = @store.update(**ids(ben), resource: "level:start", resource_revision: 0,
            value: { "properties" => { "name" => "Level neu" }, "layers" => [] })

        assert first[:applied]
        assert second[:applied], "a change to another resource must not make this update stale"
        assert_equal 1, first[:revision]
        assert_equal 2, second[:revision]
        assert_equal 1, first[:resource_revision]
        assert_equal "held", first[:value]["id"]
        assert_equal "Held neu", state["sprites"][0]["properties"]["name"]
        assert_equal "held", state["sprites"][0]["id"]
        assert_equal "start", state["levels"][0]["id"]
        assert_equal "Muenze", state["sprites"][1]["properties"]["name"]
    end

    def test_update_requires_the_lock
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")

        result = @store.update(**ids(ben), resource: "sprite:held", resource_revision: 0,
            value: { "properties" => { "name" => "fremd" } })

        refute result[:applied]
        assert_equal "not_locked", result[:reason]
        assert_equal "Held", result[:value]["properties"]["name"]
        assert_equal 0, result[:resource_revision]
    end

    def test_stale_update_is_rejected_with_the_current_value_and_keeps_the_lock
        anna, = session_with("Anna")
        @store.lock(**ids(anna), resource: "sprite:held")
        @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0,
            value: { "properties" => { "name" => "Version 1" }, "states" => [] })

        stale = @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0,
            value: { "properties" => { "name" => "stale" }, "states" => [] })

        refute stale[:applied]
        assert_equal "stale", stale[:reason]
        assert_equal 1, stale[:resource_revision]
        assert_equal "Version 1", stale[:value]["properties"]["name"]
        assert @store.update(**ids(anna), resource: "sprite:held", resource_revision: 1,
            value: { "properties" => { "name" => "Version 2" }, "states" => [] })[:applied]
    end

    def test_settings_are_a_resource_too
        anna, = session_with("Anna")
        @store.lock(**ids(anna), resource: "settings")

        result = @store.update(**ids(anna), resource: "settings", resource_revision: 0,
            value: { "title" => "Neu" })

        assert result[:applied]
        assert_equal "Neu", state["properties"]["title"]
    end

    def test_resource_revisions_are_part_of_the_snapshot
        anna, = session_with("Anna")
        @store.lock(**ids(anna), resource: "sprite:muenze")
        @store.update(**ids(anna), resource: "sprite:muenze", resource_revision: 0, value: { "states" => [] })

        assert_equal({ "sprite:muenze" => 1 }, @store.snapshot(code: "session")[:resource_revisions])
    end

    # --------------------------------------------------------------- structure

    def test_insert_places_a_new_sprite_after_the_given_one
        anna, = session_with("Anna")

        result = @store.insert(**ids(anna), kind: "sprite", after_id: "held",
            value: { "id" => "neu", "states" => [] })

        assert result[:applied]
        assert_equal 1, result[:revision]
        assert_equal %w[held neu muenze], result[:order]
        assert_equal "neu", result[:value]["id"]
        assert_equal %w[held neu muenze], order("sprites")
        assert @store.lock(**ids(anna), resource: "sprite:neu")[:applied]
    end

    def test_insert_at_the_start_and_with_an_unknown_anchor
        anna, = session_with("Anna")

        @store.insert(**ids(anna), kind: "level", after_id: nil, value: { "id" => "vorne" })
        @store.insert(**ids(anna), kind: "level", after_id: "geloescht", value: { "id" => "hinten" })

        assert_equal %w[vorne start hinten], order("levels")
    end

    def test_insert_rejects_missing_invalid_and_duplicate_ids
        anna, = session_with("Anna")

        [{ "states" => [] }, { "id" => "mit leerzeichen" }, { "id" => "held" }, "kein Objekt"].each do |value|
            result = @store.insert(**ids(anna), kind: "sprite", after_id: nil, value: value)
            refute result[:applied]
            assert_equal "invalid", result[:reason]
        end
        refute @store.insert(**ids(anna), kind: "frame", after_id: nil, value: { "id" => "x" })[:applied]
        assert_equal %w[held muenze], order("sprites")
    end

    def test_delete_removes_the_sprite_its_lock_and_its_revision
        anna, = session_with("Anna")
        @store.lock(**ids(anna), resource: "sprite:muenze")
        @store.update(**ids(anna), resource: "sprite:muenze", resource_revision: 0, value: {})

        result = @store.delete(**ids(anna), kind: "sprite", id: "muenze")

        assert result[:applied]
        assert_equal %w[held], result[:order]
        assert_nil result[:participants].first[:lock]
        refute_includes @store.snapshot(code: "session")[:resource_revisions].keys, "sprite:muenze"
    end

    def test_references_to_a_deleted_sprite_are_left_alone
        @state["levels"][0]["layers"] = [{ "type" => "sprites", "sprites" => [["muenze", 1, 2], ["held", 3, 4]] }]
        anna, = session_with("Anna")

        @store.delete(**ids(anna), kind: "sprite", id: "muenze")

        assert_equal [["muenze", 1, 2], ["held", 3, 4]], state["levels"][0]["layers"][0]["sprites"]
    end

    def test_delete_is_refused_while_somebody_else_edits_the_sprite
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(ben), resource: "sprite:muenze")

        result = @store.delete(**ids(anna), kind: "sprite", id: "muenze")

        refute result[:applied]
        assert_equal "locked", result[:reason]
        assert_equal %w[held muenze], order("sprites")
    end

    def test_the_last_sprite_or_level_cannot_be_deleted
        anna, = session_with("Anna")

        result = @store.delete(**ids(anna), kind: "level", id: "start")

        refute result[:applied]
        assert_equal "last_item", result[:reason]
    end

    def test_deleting_an_unknown_id_is_rejected
        anna, = session_with("Anna")

        assert_equal "unknown_resource", @store.delete(**ids(anna), kind: "sprite", id: "nope")[:reason]
    end

    def test_move_puts_the_item_after_the_anchor_or_first
        anna, = session_with("Anna")
        @store.insert(**ids(anna), kind: "sprite", after_id: "muenze", value: { "id" => "drei" })

        assert_equal %w[muenze drei held], @store.move(**ids(anna), kind: "sprite", id: "held", after_id: "drei")[:order]
        assert_equal %w[held muenze drei], @store.move(**ids(anna), kind: "sprite", id: "held", after_id: nil)[:order]
        assert_equal %w[muenze held drei], @store.move(**ids(anna), kind: "sprite", id: "held", after_id: "muenze")[:order]
    end

    def test_move_with_an_unknown_item_or_anchor_is_rejected
        anna, = session_with("Anna")

        assert_equal "unknown_resource", @store.move(**ids(anna), kind: "sprite", id: "nope", after_id: nil)[:reason]
        assert_equal "unknown_resource", @store.move(**ids(anna), kind: "sprite", id: "held", after_id: "nope")[:reason]
        assert_equal "unknown_resource", @store.move(**ids(anna), kind: "sprite", id: "held", after_id: "held")[:reason]
        assert_equal %w[held muenze], order("sprites")
    end

    def test_every_applied_operation_advances_the_revision_by_one
        anna, = session_with("Anna")
        @store.lock(**ids(anna), resource: "sprite:held")
        revisions = [
            @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0, value: {})[:revision],
            @store.insert(**ids(anna), kind: "sprite", after_id: nil, value: { "id" => "neu" })[:revision],
            @store.move(**ids(anna), kind: "sprite", id: "neu", after_id: "muenze")[:revision],
            @store.delete(**ids(anna), kind: "sprite", id: "neu")[:revision],
        ]

        assert_equal [1, 2, 3, 4], revisions
        assert_equal 4, @store.snapshot(code: "session")[:revision]
    end

    def test_operations_need_the_current_connection
        anna, = session_with("Anna")
        @store.leave(**ids(anna))

        assert_raises(Collaboration::InvalidParticipant) do
            @store.lock(**ids(anna), resource: "sprite:held")
        end
    end

end
