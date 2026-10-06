# ruby test/sheet_repair_test.rb – sprite sheets that went wrong, found and
# made again (src/ruby/sheet_repair.rb); the rendering itself is main.rb.
require "minitest/autorun"
require "tmpdir"
require "json"
require_relative "../src/ruby/sheet_repair"

class SheetRepairTest < Minitest::Test
    PNG = SheetRepair::PNG_SIGNATURE + "rest of a picture".b

    def setup_dirs(dir)
        sheets = File.join(dir, "spritesheets")
        games = File.join(dir, "games")
        FileUtils.mkpath([sheets, games])
        [sheets, games]
    end

    def test_a_sheet_is_a_picture_only_with_the_png_signature
        Dir.mktmpdir do |dir|
            File.binwrite(File.join(dir, "good.png"), PNG)
            File.write(File.join(dir, "bad.png"), { "spritesheets" => [] }.to_json)
            assert SheetRepair.png?(File.join(dir, "good.png"))
            refute SheetRepair.png?(File.join(dir, "bad.png"))
            refute SheetRepair.png?(File.join(dir, "missing.png"))
        end
    end

    def test_an_info_is_fine_only_when_every_sheet_it_names_is_a_picture
        Dir.mktmpdir do |dir|
            sheets, = setup_dirs(dir)
            File.binwrite(File.join(sheets, "aaa.png"), PNG)
            File.write(File.join(sheets, "bbb.png"), "{}")
            File.write(File.join(sheets, "good.json"), { "spritesheets" => ["aaa.png"] }.to_json)
            File.write(File.join(sheets, "broken.json"), { "spritesheets" => ["aaa.png", "bbb.png"] }.to_json)
            File.write(File.join(sheets, "gone.json"), { "spritesheets" => ["ccc.png"] }.to_json)
            assert SheetRepair.info_ok?(File.join(sheets, "good.json"), sheets)
            refute SheetRepair.info_ok?(File.join(sheets, "broken.json"), sheets)
            refute SheetRepair.info_ok?(File.join(sheets, "gone.json"), sheets)
            refute SheetRepair.info_ok?(File.join(sheets, "missing.json"), sheets)
        end
    end

    # what the bug left: the info written into a shared sheet, no info for the
    # new game – the old game that shares the sheet is broken too
    def test_repair_removes_broken_sheets_and_renders_what_needs_it
        Dir.mktmpdir do |dir|
            sheets, games = setup_dirs(dir)
            play_games = File.join(dir, "play", "games")
            play_infos = File.join(dir, "play", "sheets")
            FileUtils.mkpath([play_games, play_infos])
            File.binwrite(File.join(sheets, "fine.png"), PNG)
            File.write(File.join(sheets, "shared.png"), { "spritesheets" => ["shared.png"], "tiles" => [] }.to_json)
            %w[oldgame newgame other12 fresh01].each { |tag| File.write(File.join(games, "#{tag}.json"), "{}") }
            File.write(File.join(sheets, "oldgame.json"), { "spritesheets" => ["shared.png"] }.to_json)
            File.write(File.join(sheets, "other12.json"), { "spritesheets" => ["fine.png"] }.to_json)
            # an old game without info, written long ago: left alone (it renders when loaded)
            File.utime(Time.now - 100 * 24 * 3600, Time.now - 100 * 24 * 3600, File.join(games, "fresh01.json"))
            File.write(File.join(play_games, "copy123.json"), "{}")
            rendered = []
            report = SheetRepair.repair(sheets, [
                { games_dir: games, info_dir: sheets, since: Time.now - 14 * 24 * 3600 },
                { games_dir: play_games, info_dir: play_infos, since: nil },
            ]) do |tag, games_dir, info_dir|
                rendered << [tag, games_dir == play_games]
                raise "kaputt" if tag == "newgame" && rendered.count { |r| r[0] == "newgame" } == 1
            end
            assert_equal ["shared.png"], report[:broken_sheets]
            refute File.exist?(File.join(sheets, "shared.png"))
            assert File.exist?(File.join(sheets, "fine.png"))
            refute File.exist?(File.join(sheets, "oldgame.json")), "its info named the broken sheet"
            assert File.exist?(File.join(sheets, "other12.json"))
            assert_equal [["oldgame", false], ["newgame", false], ["copy123", true]].sort, rendered.sort
            assert_equal %w[copy123 oldgame], report[:rendered].sort
            assert_equal 1, report[:failed].size
            assert_match(/newgame: kaputt/, report[:failed].first)
        end
    end

    def test_nothing_to_do_does_nothing
        Dir.mktmpdir do |dir|
            sheets, games = setup_dirs(dir)
            File.binwrite(File.join(sheets, "fine.png"), PNG)
            File.write(File.join(games, "abc1234.json"), "{}")
            File.write(File.join(sheets, "abc1234.json"), { "spritesheets" => ["fine.png"] }.to_json)
            report = SheetRepair.repair(sheets, [{ games_dir: games, info_dir: sheets, since: nil }]) { flunk "nothing to render" }
            assert_equal({ broken_sheets: [], rendered: [], failed: [] }, report)
        end
    end
end
