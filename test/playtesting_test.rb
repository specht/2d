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

    def test_a_team_submits_its_game_once_and_none_of_them_tests_it
        state = on_state
        # Mia submits the team's game (the session's version v1)
        team, error, already = Playtesting.submit(state, "v1aaaaa", game("Burg", "Mia, Ben"), "mia")
        assert_nil error
        assert_equal false, already
        other, = Playtesting.submit(state, "zzzzzzz", game("Andere", "Lea"), "lea")
        # Ben asks from inside the session: one of the team now
        assert_equal team, Playtesting.join_team(state, "ben", "v1aaaaa")
        assert_nil Playtesting.join_team(state, "ben", "v1aaaaa"), "once is enough"
        assert_nil Playtesting.join_team(state, "ben", "nichtda"), "a game nobody submitted"
        # a shared save moves it on; Ben sees it as the team's game
        Playtesting.after_save(state, "v2aaaaa", game("Burg", "Mia, Ben", "v1aaaaa"))
        status = Playtesting.status(state, "ben", open_tag: "v2aaaaa")
        assert_equal [[team["id"], true, "Mia, Ben"]], status["submissions"].map { |s| s.values_at("id", "team", "author") }
        assert_equal({ "id" => team["id"], "title" => "Burg", "author" => "Mia, Ben", "team" => true }, status["open_game"])
        assert_equal 2, status["games"], "one game for the team, not one each"
        # Tom (not in the session) has the game open: he is told, not made one of the team
        tom = Playtesting.status(state, "tom", open_tag: "v2aaaaa")
        assert_equal [false, []], [tom["open_game"]["team"], tom["submissions"]]
        # Paul submits it again from the session: no second entry, he is told
        again, error, already = Playtesting.submit(state, "v3aaaaa", game("Burg", "Mia, Ben, Paul", "v2aaaaa"), "paul")
        assert_nil error
        assert_equal [team["id"], true], [again["id"], already]
        assert_equal 2, state["submissions"].size
        # nobody of the team gets it to test – only the other game
        now = Time.utc(2026, 10, 12, 9, 0)
        %w(mia ben paul).each do |b|
            assert_equal other["id"], Playtesting.next_assignment(state, b, b, now)["submission"], b
        end
        assert_equal team["id"], Playtesting.next_assignment(state, "lea", "Lea", now)["submission"]
        # the teacher's overview counts it the same way
        overview = Playtesting.overview(state, now)
        burg = overview["games"].find { |g| g["id"] == team["id"] }
        assert_equal 0, burg["left"], "the team cannot test it, Lea is testing it already"
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

    def test_the_class_view_shows_every_child_their_game_teams_progress_and_the_surveys
        state = on_state
        t0 = Time.utc(2026, 10, 7, 9, 0)
        # Lea submits alone; Max and Ida make "Höhle" together (Ida joined in the session)
        lea, = Playtesting.submit(state, "leaaaaa", game("Lea Welt", "Lea"), "b_lea", t0)
        cave, = Playtesting.submit(state, "cavaaaa", game("Höhle", "Max und Ida"), "b_max", t0)
        Playtesting.join_team(state, "b_ida", "cavaaaa")
        # names as the studio's ping brings them; Tom has not submitted anything
        assert Playtesting.remember_browser(state, "b_lea", { "author" => "Lea" })
        refute Playtesting.remember_browser(state, "b_lea", { "author" => "Lea" })   # nothing new: not written
        Playtesting.remember_browser(state, "b_max", { "session" => "Max" })
        Playtesting.remember_browser(state, "b_ida", { "session" => "Ida", "tester" => "Ida K." })
        Playtesting.remember_browser(state, "b_tom", { "author" => "Tom" })
        assert_nil Playtesting.join_class(state, "b_tom", state["code"].downcase)   # typed in small letters
        Playtesting.remember_browser(state, "b_eva", { "session" => "Eva" })
        # Lea tests Höhle and sends the survey; Tom is testing Lea's game right now
        a = Playtesting.next_assignment(state, "b_lea", "Lea", t0 + 60)
        assert_equal cave["id"], a["submission"]
        Playtesting.give_feedback(state, a["id"], "b_lea", answers, t0 + 300)
        b = Playtesting.next_assignment(state, "b_tom", "Tom", t0 + 400)
        assert_equal lea["id"], b["submission"]
        # live: Max and Eva in a session on Höhle (Eva joined late and never opened Playtesting),
        # Paul and Ben in a session on a game nobody submitted
        sessions = [{ key: "K1", source_tag: "cavaaaa", title: "Höhle", names: ["Max", "Eva"] },
                    { key: "K2", source_tag: "zzzaaaa", title: "Rennen", names: ["Paul", "Ben"] }]
        seen = { "b_max" => { at: t0 + 410, session: "K1" }, "b_eva" => { at: t0 + 410, session: "K1" },
                 "b_tom" => { at: t0 + 300, session: nil }, "b_ben" => { at: t0 + 405, session: "K2" } }
        view = Playtesting.class_view(state, sessions: sessions, seen: seen, now: t0 + 420)

        kids = view["kids"].to_h { |k| [k["name"] || "?", k] }
        assert_equal ["Ida K.", "Lea", "Max", "Eva", "Tom"].sort, kids.keys.sort
        # Ben has the studio open, in a session nobody submitted, without the code
        assert_equal [nil], view["without_code"]
        assert_equal state["code"], view["code"]
        assert_equal ["Lea Welt", false, true], kids["Lea"]["game"].values_at("title", "team", "submitted")
        assert_equal ["Höhle", true], kids["Ida K."]["game"].values_at("title", "team")
        assert_equal "Höhle", kids["Eva"]["game"]["title"]           # through her session
        assert_nil kids["Tom"]["game"]                                 # nothing in the round
        assert_nil kids["Tom"]["left"]                                 # so he does not test
        assert kids["Max"]["game"]["team"]                             # submitted it, with Ida: a team
        assert_equal "Lea Welt", kids["Tom"]["running"]["title"]
        assert kids["Max"]["online"]
        refute kids["Tom"]["online"]                                   # 2 minutes since the last ping
        assert_equal 1, kids["Lea"]["done"]
        assert_equal 0, kids["Lea"]["left"]                            # never her own, never twice
        # those without anything in the round come first
        assert_equal [false, true, true, true, true], view["kids"].map { |k| !!k["game"]&.dig("submitted") }

        games = view["games"].to_h { |g| [g["title"], g] }
        assert_equal ["Max", "Ida K.", "Eva"], games["Höhle"]["team"]
        assert games["Höhle"]["in_session"]
        assert_equal 1, games["Höhle"]["done"]
        assert_equal [["Höhle", "Höhle"], ["Rennen", nil]], view["sessions"].map { |x| x.values_at("title", "submitted") }

        assert_equal 1, view["feedback"].size
        assert_equal ["Lea", "Höhle", "Die Musik!"], view["feedback"][0].values_at("name", "title").push(view["feedback"][0]["answers"]["good"])
    end

    def test_the_store_writes_names_only_when_they_change_and_only_while_on
        Dir.mktmpdir do |dir|
            store = Playtesting::Store.new(File.join(dir, "playtesting"))
            refute store.remember_browser("b_lea", { "author" => "Lea" })      # off: nothing
            store.transaction { |state| state["enabled"] = true }
            assert store.remember_browser("b_lea", { "author" => "Lea" })
            mtime = File.mtime(store.path)
            refute store.remember_browser("b_lea", { "author" => "Lea", "tester" => "" })
            assert_equal mtime, File.mtime(store.path)
            assert store.remember_browser("b_lea", { "tester" => "Lea M." })
            assert_equal({ "author" => "Lea", "tester" => "Lea M." }, store.read["browsers"]["b_lea"])
            store.reset   # a new round: a new class list
            assert_nil store.read["browsers"]
        end
    end

    def test_first_everybody_submits_then_the_teacher_starts_and_ends_the_testing
        state = Playtesting.fresh_state(false)
        assert_equal "playtesting_off", Playtesting.may_test(state, "b_lea")
        assert_nil Playtesting.control(state, "on")
        refute state["testing"]
        Playtesting.submit(state, "leaaaaa", game("Lea Welt", "Lea"), "b_lea")
        cave, = Playtesting.submit(state, "cavaaaa", game("Höhle", "Max"), "b_max")
        Playtesting.join_team(state, "b_ida", "cavaaaa")
        # still submitting: nobody tests yet
        assert_equal "not_started", Playtesting.may_test(state, "b_lea")
        now = Time.utc(2026, 10, 7, 9, 0)
        assert_nil Playtesting.control(state, "start", nil, now)
        assert_equal "2026-10-07T09:00:00Z", state["testing_since"]
        # who has a game in the round tests – alone or as a team; Tom has none
        assert_nil Playtesting.may_test(state, "b_lea")
        assert_nil Playtesting.may_test(state, "b_ida")
        assert_equal "submit_first", Playtesting.may_test(state, "b_tom")
        a = Playtesting.next_assignment(state, "b_lea", "Lea", now)
        assert_equal cave["id"], a["submission"]
        # the teacher ends it: no new tests, the one under way goes on
        Playtesting.control(state, "stop")
        assert_equal "not_started", Playtesting.may_test(state, "b_lea")
        assert_equal a["id"], Playtesting.running_for(state, "b_lea", now + 60)["id"]
        assert_nil Playtesting.give_feedback(state, a["id"], "b_lea", answers, now + 200)[1]
        assert_nil Playtesting.running_for(state, "b_lea", now + 210)
        # the status tells the studio which phase and whether one has a game
        status = Playtesting.status(state, "b_tom")
        assert_equal [false, false], status.values_at("testing", "has_game")
        assert Playtesting.status(state, "b_ida")["has_game"]
        assert_equal "bad_minutes", Playtesting.control(state, "minutes", 0)
        assert_nil Playtesting.control(state, "minutes", 5)
        assert_equal 5, state["minutes"]
        assert_equal "unknown_action", Playtesting.control(state, "explode")
        Playtesting.control(state, "off")
        refute state["enabled"]
    end

    def test_a_class_code_lets_children_take_part
        state = on_state
        code = state["code"]
        assert_match(/\A[A-HJ-KM-NP-Z2-9]{4}\z/, code)
        refute Playtesting.in_class?(state, "b_lea")
        assert_equal "wrong_code", Playtesting.join_class(state, "b_lea", "ZZZZ")
        assert_nil Playtesting.join_class(state, "b_lea", " #{code[0, 2].downcase}-#{code[2, 2]} ")
        assert Playtesting.in_class?(state, "b_lea")
        assert Playtesting.status(state, "b_lea")["in_class"]
        # a team member (joined in the session of the submitted game) is in by that
        Playtesting.submit(state, "leaaaaa", game("Lea Welt", "Lea"), "b_lea")
        Playtesting.join_team(state, "b_max", "leaaaaa")
        assert Playtesting.in_class?(state, "b_max")
        # a new code: who is in stays in
        Playtesting.control(state, "new_code")
        refute_equal code, state["code"] if state["code"] != code
        assert Playtesting.in_class?(state, "b_lea")
        assert_equal "wrong_code", Playtesting.join_class(state, "b_tom", code) unless state["code"] == code
        # an older round without a code gets one when switched on
        old = Playtesting.fresh_state(false).tap { |s| s.delete("code") }
        Playtesting.control(old, "on")
        assert_equal 4, old["code"].size
    end

    # The moderation page prints rounds before, too: only real archive names
    def test_the_rounds_before_can_be_read_back_by_name
        Dir.mktmpdir do |dir|
            store = Playtesting::Store.new(File.join(dir, "playtesting"))
            store.transaction { |state| state["minutes"] = 7 }
            store.reset
            names = store.archives
            assert_equal 1, names.size
            assert_match(/\A\d{4}-\d{2}-\d{2}-\d{6}\z/, names.first)
            assert_equal 7, store.read_archive(names.first)["minutes"]
            [nil, "", "../state", "#{names.first}.json", "2026-01-01-000000"].each { |bad| assert_nil store.read_archive(bad) }
        end
    end

    # „Ich brauche mehr Zeit“: two minutes at a time, four in all, only for
    # one's own running test; the test runs (and counts as running) that long
    def test_a_tester_may_ask_for_more_time
        state = Playtesting.fresh_state(true, 3)
        Playtesting.submit(state, "aaaaaaa", { "properties" => { "title" => "Pip", "author" => "Lea" } }, "owner")
        t0 = Time.utc(2026, 10, 8, 9, 0)
        a = Playtesting.next_assignment(state, "t1", "Tom", t0)
        client = Playtesting.assignment_for_client(state, a, t0)
        assert_equal [180, 180, 0, 2], client.values_at("seconds_left", "seconds_total", "extra_minutes", "more_time")
        assert_equal [nil, "unknown_assignment"], Playtesting.more_time(state, a["id"], "someone_else", t0)
        Playtesting.more_time(state, a["id"], "t1", t0 + 60)
        client = Playtesting.assignment_for_client(state, a, t0 + 60)
        assert_equal [240, 300, 2, 2], client.values_at("seconds_left", "seconds_total", "extra_minutes", "more_time")
        Playtesting.more_time(state, a["id"], "t1", t0 + 120)
        assert_equal 0, Playtesting.assignment_for_client(state, a, t0 + 120)["more_time"]
        assert_equal [nil, "no_more_time"], Playtesting.more_time(state, a["id"], "t1", t0 + 130)
        # still running after the usual end plus the grace minutes
        assert Playtesting.running?(a, 3, t0 + (3 + Playtesting::GRACE_MINUTES + 3) * 60)
        refute Playtesting.running?(a, 3, t0 + (3 + Playtesting::GRACE_MINUTES + 5) * 60)
    end
end
