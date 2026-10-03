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
