require "minitest/autorun"
require "tmpdir"
require_relative "../src/ruby/collaboration"

class CollaborationStoreTest < Minitest::Test
    def setup
        @now = 1_000.0
        @ids = %w(session participant-a connection-a participant-b connection-b connection-new extra extra2 extra3 extra4 extra5 extra6 extra7 extra8 extra9)
        @token_count = 0
        @store = Collaboration::Store.new(
            clock: -> { @now },
            session_ttl: 100,
            reconnect_grace: 10,
            stale_after: 50,
            lock_lease: 30,
            token_generator: -> { "token-#{@token_count += 1}" },
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
            reconnect_token: first[:reconnect_token],
        )

        refute_equal old_connection, reconnected[:connection_id]
        refute @store.leave(
            code: "session",
            participant_id: participant_id,
            connection_id: old_connection,
        )
        assert_equal ["Mia"], @store.snapshot(code: "session")[:participants].map { |p| p[:name] }
    end

    def test_a_known_participant_id_alone_does_not_take_over_a_participant
        @store.create(state: @state)
        first = @store.join(code: "session", name: "Mia")
        @store.leave(code: "session", participant_id: first[:participant_id], connection_id: first[:connection_id])

        without_token = @store.join(code: "session", name: "Mia", participant_id: first[:participant_id])
        wrong_token = @store.join(code: "session", name: "Mia", participant_id: first[:participant_id],
            reconnect_token: "token-99")

        refute_equal first[:participant_id], without_token[:participant_id]
        refute_equal first[:participant_id], wrong_token[:participant_id]
    end

    def test_the_reconnect_token_takes_over_a_still_connected_participant_with_its_lock
        @store.create(state: @state)
        first = @store.join(code: "session", name: "Mia")
        @store.lock(**ids(first), resource: "sprite:held")

        again = @store.join(code: "session", name: "Mia", participant_id: first[:participant_id],
            reconnect_token: first[:reconnect_token])

        assert_equal first[:participant_id], again[:participant_id]
        assert_equal first[:connection_id], again[:replaced_connection_id]
        assert_equal first[:reconnect_token], again[:reconnect_token]
        participants = again[:snapshot][:participants]
        assert_equal 1, participants.length
        assert_equal "sprite:held", participants.first[:lock][:resource]
        assert_raises(Collaboration::InvalidParticipant) { @store.touch(**ids(first)) }
        refute @store.leave(**ids(first)), "the old connection closing later changes nothing"
        assert @store.touch(**ids(again))[:participants].first[:lock]
    end

    def test_a_copy_of_oneself_can_be_removed_with_its_lock_but_nobody_else
        @store.create(state: @state)
        old = @store.join(code: "session", name: "Mia")
        @store.lock(code: "session", participant_id: old[:participant_id], connection_id: old[:connection_id], resource: "sprite:held")
        mia = @store.join(code: "session", name: " mia ")
        ben = @store.join(code: "session", name: "Ben")
        ids = ->(p) { { code: "session", participant_id: p[:participant_id], connection_id: p[:connection_id] } }

        # nobody else, not oneself
        refused = @store.remove(**ids.call(ben), target_id: old[:participant_id])
        assert_equal [false, "not_same_name"], [refused[:removed], refused[:reason]]
        assert_equal "self", @store.remove(**ids.call(mia), target_id: mia[:participant_id])[:reason]
        assert_equal "unknown_participant", @store.remove(**ids.call(mia), target_id: "nobody")[:reason]

        removed = @store.remove(**ids.call(mia), target_id: old[:participant_id])
        assert removed[:removed]
        assert_equal [mia[:participant_id], ben[:participant_id]], removed[:participants].map { |p| p[:id] }
        # its lock is free at once
        assert @store.lock(**ids.call(mia), resource: "sprite:held")[:applied]
        # it cannot come back as itself, and its connection does nothing any more
        # its old tab reconnects by itself: refused, not let in as somebody new
        assert_raises(Collaboration::ParticipantRemoved) do
            @store.join(code: "session", name: "Mia", participant_id: old[:participant_id], reconnect_token: old[:reconnect_token])
        end
        assert_equal 2, @store.participants(code: "session").size
        # joining anew (typing the name) works
        fresh = @store.join(code: "session", name: "Mia")
        refute_equal old[:participant_id], fresh[:participant_id]
        assert_raises(Collaboration::InvalidParticipant) do
            @store.touch(code: "session", participant_id: old[:participant_id], connection_id: old[:connection_id])
        end
    end

    def test_the_source_tag_without_a_copy_of_the_game
        @store.create(state: @state, source_tag: "abc1234")
        assert_equal "abc1234", @store.source_tag(code: "session")
        assert_nil @store.source_tag(code: "nothere")
    end

    def test_reconnect_tokens_are_never_shown_to_others
        @store.create(state: @state)
        mia = @store.join(code: "session", name: "Mia")
        ben = @store.join(code: "session", name: "Ben")

        refute_includes ben[:snapshot].to_s, mia[:reconnect_token]
        refute_equal mia[:reconnect_token], ben[:reconnect_token]
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
            reconnect_token: first[:reconnect_token],
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
            reconnect_token: joined[:reconnect_token],
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
        # Ben's change is not in new1234: it counts as unsaved, the next save is a real one
        assert_equal 0, saved[:saved_revision]
        again = @store.begin_save(code: "session", participant_id: anna[:participant_id], connection_id: anna[:connection_id])
        refute again[:unchanged]
    end

    def test_a_save_without_changes_since_the_last_one_is_marked_unchanged
        @store.create(state: @state, source_tag: "abc1234")
        anna = @store.join(code: "session", name: "Anna")
        ben = @store.join(code: "session", name: "Ben")
        save = ->(who) { @store.begin_save(code: "session", participant_id: who[:participant_id], connection_id: who[:connection_id]) }
        # the game the session started from may differ from the session's state: never a repeat
        first = save.(anna)
        refute first[:unchanged]
        saved = @store.finish_save(code: "session", token: first[:token], tag: "new1234")
        assert_equal saved[:revision], saved[:saved_revision]
        # Ben presses Speichern right after Anna: nothing changed
        second = save.(ben)
        assert second[:unchanged]
        assert_equal "new1234", second[:source_tag]
        @store.finish_save(code: "session", token: second[:token], tag: "new1234")
        # a change: a real save again
        @store.lock(**ids(ben), resource: "settings")
        @store.update(**ids(ben), resource: "settings", resource_revision: 0, value: { "title" => "Neu" })
        refute save.(anna)[:unchanged]
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


    # ---------------------------------------------------------------- liveness

    def test_a_participant_that_stops_responding_loses_its_lock
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @now += 40
        refute @store.touch(**ids(ben))[:expired]
        @now += 11 # Anna silent for 51 s, Ben for 11 s

        result = @store.touch(**ids(ben))

        assert result[:expired]
        assert_equal ["Ben"], result[:participants].map { |p| p[:name] }
        assert @store.lock(**ids(ben), resource: "sprite:held")[:applied]
        assert_raises(Collaboration::InvalidParticipant) { @store.touch(**ids(anna)) }
    end

    def test_an_expired_participant_can_rejoin_with_its_token
        anna, ben = session_with("Anna", "Ben")
        @now += 40
        @store.touch(**ids(ben))
        @now += 11
        @store.touch(**ids(ben)) # Anna expires now; her reconnect grace starts now
        @now += 5

        again = @store.join(code: "session", name: "Anna", participant_id: anna[:participant_id],
            reconnect_token: anna[:reconnect_token])

        assert_equal anna[:participant_id], again[:participant_id]
        assert_nil again[:replaced_connection_id]
    end

    def test_heartbeats_keep_a_participant_alive
        anna, = session_with("Anna")
        3.times do
            @now += 40
            refute @store.touch(**ids(anna))[:expired]
        end
    end

    def test_an_unused_lock_can_be_taken_over_after_the_lease
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @now += 20
        refute @store.lock(**ids(ben), resource: "sprite:held")[:applied]
        @now += 11 # Anna's lock unused for 31 s

        result = @store.lock(**ids(ben), resource: "sprite:held")

        assert result[:applied]
        locks = result[:participants].to_h { |p| [p[:name], p[:lock] && p[:lock][:resource]] }
        assert_equal({ "Anna" => nil, "Ben" => "sprite:held" }, locks)
        refute @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0, value: {})[:applied]
    end

    def test_editing_keeps_the_lease_fresh
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @now += 25
        @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0, value: {})
        @now += 25 # 50 s after locking, but only 25 s after the last change
        @store.touch(**ids(ben))

        refute @store.lock(**ids(ben), resource: "sprite:held")[:applied]
    end

    def test_locking_the_same_resource_again_does_not_renew_the_lease
        anna, ben = session_with("Anna", "Ben")
        @store.lock(**ids(anna), resource: "sprite:held")
        @now += 25
        @store.lock(**ids(anna), resource: "sprite:held")
        @now += 6
        @store.touch(**ids(ben))

        assert @store.lock(**ids(ben), resource: "sprite:held")[:applied]
    end


    # ----------------------------------------------------------- unsaved work

    def test_the_snapshot_tells_whether_changes_are_unsaved
        anna, = session_with("Anna")
        assert_equal 0, @store.snapshot(code: "session")[:saved_revision]

        @store.lock(**ids(anna), resource: "sprite:held")
        @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0, value: {})
        snapshot = @store.snapshot(code: "session")
        assert_operator snapshot[:revision], :>, snapshot[:saved_revision]

        prepared = @store.begin_save(**ids(anna))
        @store.finish_save(code: "session", token: prepared[:token], tag: "new1234")
        snapshot = @store.snapshot(code: "session")
        assert_equal snapshot[:revision], snapshot[:saved_revision]
    end

    # ------------------------------------------------------------------ limits

    def test_the_number_of_sessions_is_limited
        store = Collaboration::Store.new(max_sessions: 2)
        2.times { store.create(state: @state) }

        assert_raises(Collaboration::TooManySessions) { store.create(state: @state) }
    end

    def test_the_number_of_connected_participants_is_limited_but_rejoining_works
        store = Collaboration::Store.new(max_participants: 2)
        code = store.create(state: @state)[:code]
        first = store.join(code: code, name: "A")
        store.join(code: code, name: "B")

        assert_raises(Collaboration::SessionFull) { store.join(code: code, name: "C") }
        again = store.join(code: code, name: "A", participant_id: first[:participant_id],
            reconnect_token: first[:reconnect_token])
        assert_equal first[:participant_id], again[:participant_id]
    end

    def test_repeated_wrong_codes_block_a_client_for_a_while
        limiter = Collaboration::AttemptLimiter.new(clock: -> { @now }, max_failures: 3, window: 60)
        3.times { limiter.failure!("1.2.3.4") }

        assert limiter.blocked?("1.2.3.4")
        refute limiter.blocked?("5.6.7.8")
        @now += 61
        refute limiter.blocked?("1.2.3.4")
    end

    # ------------------------------------------------------------- persistence

    def test_sessions_survive_a_restart_and_participants_reconnect_with_their_token
        Dir.mktmpdir do |dir|
            path = File.join(dir, "collaboration", "sessions.json")
            anna, ben = session_with("Anna", "Ben")
            @store.lock(**ids(anna), resource: "sprite:held")
            @store.update(**ids(anna), resource: "sprite:held", resource_revision: 0,
                value: { "properties" => { "name" => "vor dem Neustart" }, "states" => [] })
            assert @store.persist_to(path)
            assert_equal "600", format("%o", File.stat(path).mode & 0o777)

            @now += 30
            restarted = Collaboration::Store.new(clock: -> { @now }, session_ttl: 100, reconnect_grace: 10,
                id_generator: -> { "new-#{rand(1_000_000)}" })
            assert_equal 1, restarted.restore_from(path)

            snapshot = restarted.snapshot(code: "session")
            assert_equal "vor dem Neustart", snapshot[:state]["sprites"][0]["properties"]["name"]
            assert_equal 1, snapshot[:revision]
            assert_equal({ "sprite:held" => 1 }, snapshot[:resource_revisions])
            assert_empty snapshot[:participants], "nobody is connected right after a restart"

            again = restarted.join(code: "session", name: "Anna", participant_id: anna[:participant_id],
                reconnect_token: anna[:reconnect_token])
            assert_equal anna[:participant_id], again[:participant_id]
            assert_nil again[:snapshot][:participants].first[:lock], "locks are taken again after a restart"
            stranger = restarted.join(code: "session", name: "Ben", participant_id: ben[:participant_id])
            refute_equal ben[:participant_id], stranger[:participant_id], "the token is still required"
        end
    end

    def test_a_removed_copy_stays_out_after_a_restart
        Dir.mktmpdir do |dir|
            path = File.join(dir, "collaboration", "sessions.json")
            old, mia = session_with("Mia", "Mia")
            assert @store.remove(**ids(mia), target_id: old[:participant_id])[:removed]
            assert @store.persist_to(path)
            restarted = Collaboration::Store.new(clock: -> { @now }, session_ttl: 100, reconnect_grace: 10,
                id_generator: -> { "new-#{rand(1_000_000)}" })
            restarted.restore_from(path)
            assert_raises(Collaboration::ParticipantRemoved) do
                restarted.join(code: "session", name: "Mia", participant_id: old[:participant_id], reconnect_token: old[:reconnect_token])
            end
        end
    end

    def test_persisting_is_skipped_when_nothing_changed
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            anna, = session_with("Anna")
            assert @store.persist_to(path)
            refute @store.persist_to(path)

            @store.lock(**ids(anna), resource: "settings")
            @store.update(**ids(anna), resource: "settings", resource_revision: 0, value: {})
            assert @store.persist_to(path)
        end
    end

    def test_expired_and_broken_files_restore_nothing
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            session_with("Anna")
            @store.persist_to(path)
            @now += 101
            later = Collaboration::Store.new(clock: -> { @now }, session_ttl: 100)
            assert_equal 0, later.restore_from(path)

            File.write(path, "{kaputt")
            assert_equal 0, Collaboration::Store.new.restore_from(path)
            assert_equal 0, Collaboration::Store.new.restore_from(File.join(dir, "missing.json"))
        end
    end

    def test_one_client_can_only_keep_a_limited_number_of_sessions_open
        store = Collaboration::Store.new(clock: -> { @now }, max_sessions_per_creator: 2)
        2.times { store.create(state: @state, creator: "10.0.0.1") }

        assert_raises(Collaboration::TooManySessions) { store.create(state: @state, creator: "10.0.0.1") }
        store.create(state: @state, creator: "10.0.0.2")
        store.create(state: @state)
    end

    def test_the_creator_address_is_never_written_to_disk
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            @store.create(state: @state, creator: "192.0.2.17")
            @store.persist_to(path)

            refute_includes File.read(path), "192.0.2.17"
        end
    end

    def test_unchanged_sessions_are_not_serialized_again
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            anna, = session_with("Anna")
            @ids.unshift("second")
            @store.create(state: @state)
            @store.persist_to(path)

            cache = -> { @store.instance_variable_get(:@persist_cache) }
            before = cache.call.transform_values(&:last)
            @store.lock(**ids(anna), resource: "settings")
            @store.update(**ids(anna), resource: "settings", resource_revision: 0, value: { "title" => "neu" })
            assert @store.persist_to(path)
            after = cache.call.transform_values(&:last)

            assert after["second"].equal?(before["second"]), "the unchanged session's JSON is reused"
            refute after["session"].equal?(before["session"])
            restored = Collaboration::Store.new(clock: -> { @now }).tap { |store| store.restore_from(path) }
            assert_equal "neu", restored.snapshot(code: "session")[:state]["properties"]["title"]
            assert_equal "Gemeinsam", restored.snapshot(code: "second")[:state]["properties"]["title"]
        end
    end

    def test_an_ended_session_disappears_from_the_file
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            session_with("Anna")
            @store.persist_to(path)
            @now += 101

            assert @store.persist_to(path)
            assert_equal 0, Collaboration::Store.new(clock: -> { @now }).restore_from(path)
        end
    end

    # ----------------------------------------------------------------- colours

    def test_participants_get_different_colours_in_join_order
        @store.create(state: @state)
        names = %w[Anna Ben Mia Cem]
        joined = names.map { |name| @store.join(code: "session", name: name) }
        participants = @store.snapshot(code: "session")[:participants]

        assert_equal names, participants.map { |p| p[:name] }, "listed in the order they joined"
        assert_equal [0, 1, 2, 3], participants.map { |p| p[:color] }
        refute_nil joined
    end

    def test_a_participant_keeps_its_colour_when_reconnecting_and_a_newcomer_does_not_take_it
        anna, ben = session_with("Anna", "Ben")
        @store.leave(**ids(anna))
        mia = @store.join(code: "session", name: "Mia")
        again = @store.join(code: "session", name: "Anna", participant_id: anna[:participant_id],
            reconnect_token: anna[:reconnect_token])

        colours = again[:snapshot][:participants].to_h { |p| [p[:name], p[:color]] }
        assert_equal({ "Anna" => 0, "Ben" => 1, "Mia" => 2 }, colours)
        refute_nil ben
        refute_nil mia
    end

    def test_colours_are_reused_when_there_are_more_people_than_colours
        store = Collaboration::Store.new(clock: -> { @now })
        code = store.create(state: @state)[:code]
        colours = 10.times.map { |i| store.join(code: code, name: "Kind #{i}") }
        listed = store.snapshot(code: code)[:participants].map { |p| p[:color] }

        assert_equal (0..7).to_a + [0, 1], listed
        refute_nil colours
    end

    def test_colours_survive_a_restart
        Dir.mktmpdir do |dir|
            path = File.join(dir, "sessions.json")
            anna, ben = session_with("Anna", "Ben")
            @store.persist_to(path)
            restarted = Collaboration::Store.new(clock: -> { @now })
            restarted.restore_from(path)

            again = restarted.join(code: "session", name: "Ben", participant_id: ben[:participant_id],
                reconnect_token: ben[:reconnect_token])
            newcomer = restarted.join(code: "session", name: "Mia")
            colours = newcomer[:snapshot][:participants].to_h { |p| [p[:name], p[:color]] }
            assert_equal({ "Ben" => 1, "Mia" => 2 }, colours)
            refute_nil again
            refute_nil anna
        end
    end
end
