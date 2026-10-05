# ruby test/playtesting_test.rb – classroom playtesting (src/ruby/playtesting.rb)
require "minitest/autorun"
require "tmpdir"
require_relative "../src/ruby/playtesting"

class PlaytestingTest < Minitest::Test
    def game(title, author, parent = nil)
        { "properties" => { "title" => title, "author" => author }, "parent" => parent }
    end

    def on_state
        Playtesting.fresh_state(true, 5)
    end

    def answers
        { "fun" => 4, "looks" => 5, "animation" => 3, "controls" => 3, "fair" => 4, "story" => 2, "mood" => 5,
          "difficulty" => "right", "reached" => "middle", "bugs" => "none", "good" => "Die Musik!", "better" => "Mehr Level" }
    end

    def test_submitting_needs_playtesting_on_and_a_title_and_an_author
        state = Playtesting.fresh_state(false)
        assert_equal "playtesting_off", Playtesting.submit(state, "aaaaaaa", game("Pip", "Lea"), "b1")[1]
        state = on_state
        assert_equal "title_and_author_needed", Playtesting.submit(state, "aaaaaaa", game("", "Lea"), "b1")[1]
        assert_equal "title_and_author_needed", Playtesting.submit(state, "aaaaaaa", game("Pip", "  "), "b1")[1]
        submission, error = Playtesting.submit(state, "aaaaaaa", game("Pip", "Lea"), "b1")
        assert_nil error
        assert_equal ["aaaaaaa", "Pip", "Lea", "b1"], submission.values_at("tag", "title", "author", "owner")
    end

    def test_every_new_save_becomes_the_version_that_is_tested
        state = on_state
        submission, = Playtesting.submit(state, "v1aaaaa", game("Pip", "Lea"), "b1")
        assert_equal submission, Playtesting.after_save(state, "v2aaaaa", game("Pip 2", "Lea", "v1aaaaa"))
        assert_equal ["v2aaaaa", "Pip 2"], submission.values_at("tag", "title")
        # a save from an older version or another game changes nothing
        assert_nil Playtesting.after_save(state, "xxxxxxx", game("Other", "Max", "v1aaaaa"))
        assert_nil Playtesting.after_save(state, "yyyyyyy", game("Other", "Max", nil))
        # submitting the newest version again keeps the one submission
        again, = Playtesting.submit(state, "v3aaaaa", game("Pip 3", "Lea", "v2aaaaa"), "b1")
        assert_equal submission["id"], again["id"]
        assert_equal 1, state["submissions"].size
        assert_equal %w(v1aaaaa v2aaaaa v3aaaaa), again["tags"]
    end

    def test_tests_are_handed_out_evenly_never_ones_own_never_twice
        state = on_state
        ids = %w(a b c).map { |n| Playtesting.submit(state, "#{n * 7}", game("Spiel #{n}", n), "owner_#{n}")[0]["id"] }
        now = Time.utc(2026, 10, 12, 8, 0)
        # three testers: three different games
        first = %w(t1 t2 t3).map { |t| Playtesting.next_assignment(state, t, t, now, Random.new(1))["submission"] }
        assert_equal ids.sort, first.sort
        # a reload hands out the running test again
        assert_equal first[0], Playtesting.next_assignment(state, "t1", "t1", now + 60)["submission"]
        # never one's own game
        own = Playtesting.next_assignment(state, "owner_a", "A", now, Random.new(2))
        refute_equal ids[0], own["submission"]
        # after finishing, never the same game again
        a1 = Playtesting.next_assignment(state, "t1", "t1", now + 60)
        Playtesting.give_feedback(state, a1["id"], "t1", answers, now + 300)
        a2 = Playtesting.next_assignment(state, "t1", "t1", now + 310)
        refute_equal a1["submission"], a2["submission"]
        # nothing left to test
        Playtesting.give_feedback(state, a2["id"], "t1", answers, now + 600)
        a3 = Playtesting.next_assignment(state, "t1", "t1", now + 610)
        Playtesting.give_feedback(state, a3["id"], "t1", answers, now + 900)
        assert_nil Playtesting.next_assignment(state, "t1", "t1", now + 910)
    end

    def test_an_abandoned_test_stops_counting_after_its_time_and_a_grace_period
        state = on_state
        Playtesting.submit(state, "aaaaaaa", game("A", "a"), "oa")
        Playtesting.submit(state, "bbbbbbb", game("B", "b"), "ob")
        now = Time.utc(2026, 10, 12, 8, 0)
        first = Playtesting.next_assignment(state, "t1", "t1", now)["submission"]
        # while it runs, the next tester gets the other game
        refute_equal first, Playtesting.next_assignment(state, "t2", "t2", now + 60)["submission"]
        # long after: t1's test counts no more, both are even again
        later = now + (5 + Playtesting::GRACE_MINUTES + 1) * 60
        refute Playtesting.running?(state["assignments"].values.first, 5, later)
    end

    def test_feedback_is_checked_and_cut
        state = on_state
        Playtesting.submit(state, "aaaaaaa", game("A", "a"), "oa")
        a = Playtesting.next_assignment(state, "t1", "Lea", Time.now)
        assert_equal "unknown_test", Playtesting.give_feedback(state, a["id"], "t2", answers)[1]
        assert_equal "answers_missing", Playtesting.give_feedback(state, a["id"], "t1", answers.merge("good" => " "))[1]
        done, error = Playtesting.give_feedback(state, a["id"], "t1", answers.merge("fun" => 9, "evil" => "x", "better" => "x" * 5000))
        assert_nil error
        refute done["answers"].include?("fun")
        refute done["answers"].include?("evil")
        assert_equal Playtesting::MAX_TEXT, done["answers"]["better"].size
        assert_equal "already_done", Playtesting.give_feedback(state, a["id"], "t1", answers)[1]
        # a game that would not run: no texts needed
        Playtesting.submit(state, "bbbbbbb", game("B", "b"), "ob")
        b = Playtesting.next_assignment(state, "t1", "Lea", Time.now)
        assert_nil Playtesting.give_feedback(state, b["id"], "t1", { "broken" => true })[1]
    end

    def test_status_shows_ones_own_games_and_counts
        state = on_state
        Playtesting.submit(state, "aaaaaaa", game("A", "a"), "oa")
        a = Playtesting.next_assignment(state, "t1", "Lea", Time.now)
        Playtesting.give_feedback(state, a["id"], "t1", answers)
        status = Playtesting.status(state, "oa")
        assert_equal [["A", 1, 4.0]], status["submissions"].map { |s| s.values_at("title", "tests", "fun") }
        assert_equal 1, status["class_tests"]
        assert_equal 1, Playtesting.status(state, "t1")["tested"]
        assert_equal Playtesting::QUESTIONS.size, status["questions"].size
    end

    def test_store_keeps_state_under_a_lock_and_reset_archives_the_round
        Dir.mktmpdir do |dir|
            store = Playtesting::Store.new(File.join(dir, "playtesting"))
            refute store.enabled?
            store.transaction { |state| state["enabled"] = true; state["minutes"] = 7 }
            store.transaction { |state| Playtesting.submit(state, "aaaaaaa", { "properties" => { "title" => "A", "author" => "a" } }, "b") }
            assert store.enabled?
            assert_equal 1, store.read["submissions"].size
            store.reset
            assert_equal [true, 7, 0], store.read.values_at("enabled", "minutes", "submissions").then { |e, m, s| [e, m, s.size] }
            assert_equal 1, Dir[File.join(dir, "playtesting", "archive", "*.json")].size
        end
    end

    def test_saves_are_followed_through_the_store_even_while_playtesting_is_off
        Dir.mktmpdir do |dir|
            store = Playtesting::Store.new(File.join(dir, "playtesting"))
            assert_nil store.after_save("aaaaaaa", { "parent" => nil })
            store.transaction { |state| state["enabled"] = true; Playtesting.submit(state, "aaaaaaa", game("A", "a"), "b") }
            store.transaction { |state| state["enabled"] = false }
            mtime = File.mtime(store.path)
            assert_nil store.after_save("ccccccc", game("C", "c", "zzzzzzz"))
            assert_equal mtime, File.mtime(store.path)
            store.after_save("bbbbbbb", game("A 2", "a", "aaaaaaa"))
            assert_equal ["bbbbbbb", "A 2"], store.read["submissions"].values.first.values_at("tag", "title")
        end
    end
    def test_the_teachers_overview_shows_progress_per_game_tester_and_running_test
        state = on_state   # a test runs 5 minutes
        t0 = Time.utc(2026, 10, 6, 8, 0)
        pip, = Playtesting.submit(state, "pipaaaa", game("Pip", "Lea"), "lea", t0)
        rex, = Playtesting.submit(state, "rexaaaa", game("Rex", "Max"), "max", t0 + 1)
        gone, = Playtesting.submit(state, "gonaaaa", game("Weg", "Ida"), "ida", t0 + 2)
        gone["withdrawn"] = true
        # Ida started Rex an hour ago and never finished: abandoned
        state["assignments"]["old"] = { "id" => "old", "submission" => rex["id"], "browser" => "ida", "name" => "Ida",
                                        "started_at" => (t0 - 3600).utc.iso8601 }
        # Max tests Pip and finishes; Lea tests Rex, her time ran out a minute
        # ago: she is at the survey; Ida (who had Rex) tests Pip, 3 minutes left
        a = Playtesting.next_assignment(state, "max", "Max", t0 + 60)
        Playtesting.give_feedback(state, a["id"], "max", answers, t0 + 300)
        c = Playtesting.next_assignment(state, "lea", "Lea", t0 + 360)
        assert_equal rex["id"], c["submission"]
        b = Playtesting.next_assignment(state, "ida", "Ida", t0 + 600)
        assert_equal pip["id"], b["submission"]

        o = Playtesting.overview(state, t0 + 720)
        assert_equal [true, 5, 1, 1], o.values_at("enabled", "minutes", "finished", "abandoned")
        assert_equal %w(Pip Rex Weg), o["games"].map { |g| g["title"] }
        pip_row, rex_row, gone_row = o["games"]
        assert_equal [1, 1, 4.0, 0], pip_row.values_at("done", "running", "fun", "left")   # Lea made it, Max and Ida had it
        assert_equal [0, 1, nil], rex_row.values_at("done", "running", "fun")
        assert_equal 0, rex_row["left"]       # Max made it, Ida (abandoned) and Lea had it
        assert gone_row["withdrawn"]

        assert_equal [["Lea", "survey", 0, 60], ["Ida", "play", 180, 0]],
            o["running"].map { |r| r.values_at("name", "phase", "seconds_left", "seconds_over") }

        testers = o["testers"].to_h { |t| [t["name"], t.values_at("done", "running", "left")] }
        assert_equal({ "Max" => [1, 0, 0], "Ida" => [0, 1, 0], "Lea" => [0, 1, 0] }, testers)
        assert_equal "Max", o["testers"].first["name"]
    end
end
