# ruby test/playtest_pdf_test.rb – the printed playtesting feedback (src/ruby/playtest_pdf.rb)
# Needs the prawn gem (in the Ruby container; elsewhere e.g. RUBYLIB=…/prawn/lib:…).
require "minitest/autorun"
require "tmpdir"
require "zlib"
begin
    require_relative "../src/ruby/playtest_pdf"
rescue LoadError
    PlaytestPDF = nil
end

class PlaytestPDFTest < Minitest::Test
    def setup
        skip "prawn is not installed" unless PlaytestPDF
    end

    # a 2×2 RGBA PNG as the studio's canvas writes it, with filters 0 and 1
    def tiny_png
        rows = [[0, [255, 0, 0, 255, 0, 255, 0, 255]], [1, [0, 0, 255, 128, 0, 0, 0, 0]]]
        raw = rows.map do |filter, px|
            line = px.dup
            (4...line.size).reverse_each { |i| line[i] = (line[i] - line[i - 4]) & 0xff } if filter == 1
            [filter] + line
        end.flatten.pack("C*")
        chunk = ->(type, data) { [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N") }
        "\x89PNG\r\n\x1a\n".b + chunk.("IHDR", [2, 2, 8, 6, 0, 0, 0].pack("NNCCCCC")) + chunk.("IDAT", Zlib::Deflate.deflate(raw)) + chunk.("IEND", "")
    end

    def test_reads_the_pixels_of_a_png
        assert_equal [[[255, 0, 0, 255], [0, 255, 0, 255]], [[0, 0, 255, 128], [0, 0, 0, 0]]], PlaytestPDF.png_pixels(tiny_png)
        assert_nil PlaytestPDF.png_pixels("no png")
    end

    def round
        state = Playtesting.fresh_state(true)
        game = { "properties" => { "title" => "Pip 🚀", "author" => "Lea" }, "sprites" => [
            { "traits" => {}, "states" => [{ "frames" => [{ "src" => "data:image/png;base64,#{[tiny_png].pack('m0')}" }] }] }] }
        submission, = Playtesting.submit(state, "aaaaaaa", game, "owner")
        Playtesting.submit(state, "bbbbbbb", { "properties" => { "title" => "Ohne Tests", "author" => "Max" } }, "other")
        answers = { "fun" => 5, "looks" => 4, "animation" => 3, "controls" => 4, "fair" => 5, "story" => 2, "mood" => 4,
                    "difficulty" => "right", "reached" => "end", "bugs" => "small",
                    "good" => "Die Musik! 🎵", "better" => "Mehr Level", "bug_text" => "Wand rechts" }
        %w(t1 t2).each do |t|
            a = Playtesting.next_assignment(state, t, t.upcase)
            a = Playtesting.next_assignment(state, t, t.upcase) while a && a["submission"] != submission["id"] && Playtesting.give_feedback(state, a["id"], t, { "broken" => true })
            Playtesting.give_feedback(state, a["id"], t, answers.merge("fun" => t == "t1" ? 5 : 2))
        end
        [state, submission, game]
    end

    def test_sums_up_the_answers_of_a_game
        state, submission, = round
        summary = PlaytestPDF.summary(state, submission)
        assert_equal 2, summary["tests"]
        assert_in_delta 3.5, summary["scales"]["fun"]["average"]
        assert_equal [0, 1, 0, 0, 1], summary["scales"]["fun"]["counts"]
        assert_equal [["erstes Level", 0], ["ein paar Level", 0], ["bis zum Ende", 2]], summary["choices"]["reached"]
        assert_equal %w(T1 T2), summary["texts"]["good"].map { |t| t["name"] }
    end

    def test_ratings_are_words_and_several_authors_are_addressed_as_ihr
        assert_equal "gar nicht", PlaytestPDF.scale_word(1.2)
        assert_equal "gut", PlaytestPDF.scale_word(3.5)
        assert_equal "super", PlaytestPDF.scale_word(5)
        assert PlaytestPDF.several_authors?("Smilli und Charlie")
        assert PlaytestPDF.several_authors?("Lea, Max")
        refute PlaytestPDF.several_authors?("vincgames")
        refute PlaytestPDF.several_authors?("Undine")
    end

    # A game tested once with short answers: the whole handout, with the
    # plan, on one page (October 2026: the plan used to go to a second page).
    def test_a_game_tested_once_fits_on_one_page
        state = Playtesting.fresh_state(true)
        submission, = Playtesting.submit(state, "aaaaaaa", { "properties" => { "title" => "Harry Potter", "author" => "Smilli und Charlie" } }, "owner")
        a = Playtesting.next_assignment(state, "t1", "Bob")
        Playtesting.give_feedback(state, a["id"], "t1", { "fun" => 4, "looks" => 4, "animation" => 2, "controls" => 4, "fair" => 3, "story" => 2,
            "mood" => 5, "difficulty" => "easy", "reached" => "start", "bugs" => "none", "good" => "Die Figuren", "better" => "Gameplay" })
        Dir.mktmpdir do |dir|
            path = PlaytestPDF.render(state, File.join(dir, "r.pdf"), static: File.expand_path("../src/static", __dir__), gen: dir, games: dir)
            # one sheet (front and back) – nobody else was in a session on it – and the teacher's overview
            assert_equal 3, File.binread(path).scan(%r{/Type /Page\b}).size
        end
        assert submission
    end

    # Printed on both sides: every game's handout is a whole number of
    # sheets, so each team gets its own packet.
    def test_every_handout_has_an_even_number_of_pages
        state, = round
        Dir.mktmpdir do |dir|
            handout = PlaytestPDF::Handout.new(state, static: File.expand_path("../src/static", __dir__), gen: dir, games: dir)
            handout.render(File.join(dir, "r.pdf"))
            ranges = handout.instance_variable_get(:@footers).map { |first, last, _| [first, last] }
            assert_equal 2, ranges.size
            # exactly one sheet (front and back) per game
            ranges.each { |first, last| assert_equal 2, last - first + 1, ranges.inspect }
            # one after the other, the first on page 1
            assert_equal 1, ranges.first.first
            ranges.each_cons(2) { |(_, a), (b, _)| assert_equal a + 1, b }
        end
    end

    # The handout says which version was tested: its Spiel-Code and when it
    # was saved (German time) – and every version, when it was saved again.
    def test_the_tested_versions_with_their_code_and_time
        Dir.mktmpdir do |dir|
            state = Playtesting.fresh_state(true)
            first = { "properties" => { "title" => "Pip", "author" => "Lea" } }
            submission, = Playtesting.submit(state, "aaaaaaa", first, "owner")
            File.write(File.join(dir, "aaaaaaa.json"), "{}")
            File.utime(Time.utc(2026, 10, 7, 11, 52), Time.utc(2026, 10, 7, 11, 52), File.join(dir, "aaaaaaa.json"))
            test = lambda do |tester|
                a = Playtesting.next_assignment(state, tester, tester.upcase)
                Playtesting.give_feedback(state, a["id"], tester, { "fun" => 4, "looks" => 4, "animation" => 3, "controls" => 4, "fair" => 4,
                    "story" => 3, "mood" => 4, "difficulty" => "right", "reached" => "end", "bugs" => "none",
                    "good" => "Schön", "better" => "Mehr" })
            end
            handout = PlaytestPDF::Handout.new(state, static: File.expand_path("../src/static", __dir__), gen: dir, games: dir)
            # not tested yet: the version handed in
            assert_match(/\AEingereicht: Spiel-Code aaaaaaa, gespeichert am 07\.10\.2026 um 13:52/, handout.version_details(submission))
            test.("t1")
            assert_match(/\AGetestet: Spiel-Code aaaaaaa, gespeichert am 07\.10\.2026 um 13:52/, handout.version_details(submission))
            # saved again (in winter: an hour less to German time), tested twice more
            Playtesting.after_save(state, "bbbbbbb", first.merge("parent" => "aaaaaaa"))
            File.write(File.join(dir, "bbbbbbb.json"), "{}")
            File.utime(Time.utc(2026, 12, 1, 9, 5), Time.utc(2026, 12, 1, 9, 5), File.join(dir, "bbbbbbb.json"))
            %w(t2 t3).each { |t| test.(t) }
            assert_equal [["aaaaaaa", 1], ["bbbbbbb", 2]], handout.tested_list(submission).map { |tag, _, n| [tag, n] }
            assert_match(/\AGetestet: 2 Versionen, zuletzt Spiel-Code bbbbbbb, gespeichert am 01\.12\.2026 um 10:05/, handout.version_details(submission))
            handout.render(File.join(dir, "r.pdf"))
        end
    end

    # Many testers with long answers still make one sheet: smaller, in two
    # columns, shortened – and who wanted to play longer is counted.
    def test_lots_of_long_answers_still_fit_on_two_pages
        state = Playtesting.fresh_state(true)
        submission, = Playtesting.submit(state, "aaaaaaa", { "properties" => { "title" => "Viel", "author" => "Max und Tom" } }, "owner")
        long = "Das Spiel ist richtig toll, die Level sind abwechslungsreich und die Musik passt super, aber manchmal weiß man nicht, wohin. " * 3
        14.times do |i|
            answers = { "fun" => 4, "looks" => 4, "animation" => 3, "controls" => 4, "fair" => 4, "story" => 3, "mood" => 4,
                        "difficulty" => "right", "reached" => "end", "bugs" => "small", "good" => long, "better" => long, "bug_text" => long }
            id = "a#{i}"
            state["assignments"][id] = { "id" => id, "submission" => submission["id"], "tag" => "aaaaaaa", "browser" => "b#{i}", "name" => "T#{i}",
                                         "started_at" => "2026-10-08T08:00:00Z", "finished_at" => "2026-10-08T08:#{10 + i}:00Z", "answers" => answers,
                                         "extra_minutes" => i < 3 ? 2 : 0 }
        end
        assert_equal 3, PlaytestPDF.summary(state, submission)["more_time"]
        Dir.mktmpdir do |dir|
            handout = PlaytestPDF::Handout.new(state, static: File.expand_path("../src/static", __dir__), gen: dir, games: dir)
            handout.render(File.join(dir, "r.pdf"))
            # one sheet: front and back
            assert_equal [[1, 2]], handout.instance_variable_get(:@footers).map { |first, last, _| [first, last] }
            pdf = File.binread(File.join(dir, "r.pdf"))
            # the sheet and the overview
            assert_equal 3, pdf.scan(%r{/Type /Page\b}).size
        end
    end

    # A sheet for every child of a team, with the name on it: everybody who
    # was in the team's session, by the name typed there – not the author
    # field split up.
    def test_every_team_member_gets_a_sheet_with_the_name_on_it
        state = Playtesting.fresh_state(true)
        team, = Playtesting.submit(state, "aaaaaaa", { "properties" => { "title" => "Pip", "author" => "Die Pixelbande" } }, "b_lina")
        Playtesting.join_team(state, "b_theo", "aaaaaaa")
        Playtesting.join_team(state, "b_mia", "aaaaaaa")
        Playtesting.join_team(state, "b_twice", "aaaaaaa")
        Playtesting.remember_browser(state, "b_lina", { "session" => "Lina", "author" => "Die Pixelbande" })
        # the name in the session counts, not the one given for testing
        Playtesting.remember_browser(state, "b_theo", { "session" => "Theodor", "tester" => "Theo" })
        # no session name known: the name it goes by
        Playtesting.remember_browser(state, "b_mia", { "tester" => "Mia" })
        # the same child on a second computer: one sheet
        Playtesting.remember_browser(state, "b_twice", { "session" => "lina" })
        solo, = Playtesting.submit(state, "bbbbbbb", { "properties" => { "title" => "Solo", "author" => "Anton und Ben" } }, "b_anton")
        Playtesting.remember_browser(state, "b_anton", { "session" => "Anton" })
        assert_equal %w(Lina Theodor Mia), PlaytestPDF.team_names(state, team)
        # "Anton und Ben" as the author, but only Anton was ever in it: one sheet, no name
        assert_equal [], PlaytestPDF.team_names(state, solo)
        Dir.mktmpdir do |dir|
            handout = PlaytestPDF::Handout.new(state, static: File.expand_path("../src/static", __dir__), gen: dir, games: dir,
                                               link_root: "https://2d.example.org/")
            handout.render(File.join(dir, "r.pdf"))
            footers = handout.instance_variable_get(:@footers)
            assert_equal [["Pip", "Lina"], ["Pip", "Theodor"], ["Pip", "Mia"], ["Solo", nil]],
                         footers.map { |_, _, s, name| [s["title"], name] }.sort_by { |t, n| [t, %w(Lina Theodor Mia).index(n) || 9] }
            footers.each { |first, last, _| assert_equal 1, last - first }
            assert_equal "https://2d.example.org/?aaaaaaa", handout.tap { |h| h.instance_variable_set(:@current, team) }.game_link
        end
    end

    def test_writes_a_pdf_with_a_page_per_game_and_the_overview
        state, = round
        Dir.mktmpdir do |dir|
            path = PlaytestPDF.render(state, File.join(dir, "r.pdf"), static: File.expand_path("../src/static", __dir__), gen: dir, games: dir)
            pdf = File.binread(path)
            assert pdf.start_with?("%PDF")
            assert_operator pdf.scan(%r{/Type /Page\b}).size, :>=, 3
        end
    end
end
