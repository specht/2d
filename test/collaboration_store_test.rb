require "minitest/autorun"
require_relative "../src/ruby/collaboration"

class CollaborationStoreTest < Minitest::Test
    def setup
        @now = 1_000.0
        @ids = %w(session participant-a connection-a participant-b connection-b connection-new extra)
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
            "sprites" => [],
            "levels" => [],
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
end
