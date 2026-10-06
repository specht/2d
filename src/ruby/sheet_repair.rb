# Sprite sheets that went wrong, found and made again.
#
# /gen/spritesheets holds the sheets (<sha>.png, shared by every game whose
# frames are laid out the same) and each game's sheet info (<tag>.json, which
# sheets and where every frame is); play copies keep their info below /raw
# (play_copies.rb). For a while, render_spritesheet_for_tag wrote the info into
# the file of the last sheet instead of <tag>.json – so games had no info, and
# sheets other games share held JSON instead of a picture. This finds both:
#
# - a sheet that is not a PNG is deleted (rendering makes it again)
# - an info that names a sheet that is not there is deleted (and rendered again)
# - a game written since `since` that has no info is rendered
#
# Rendering itself is Main.render_spritesheet_for_tag (passed in as a block),
# so this is pure Ruby; tested in test/sheet_repair_test.rb.
require "fileutils"
require "json"

module SheetRepair
    PNG_SIGNATURE = "\x89PNG\r\n\x1a\n".b

    def self.png?(path)
        File.open(path, "rb") { |f| f.read(8) } == PNG_SIGNATURE
    rescue
        false
    end

    # An info that is there, and every sheet it names is a picture.
    def self.info_ok?(path, sheets_dir)
        sheets = JSON.parse(File.read(path))["spritesheets"]
        sheets.is_a?(Array) && sheets.all? { |name| name.is_a?(String) && png?(File.join(sheets_dir, File.basename(name))) }
    rescue
        false
    end

    # Sheets that are no PNG: deleted. Returns their names.
    def self.remove_broken_sheets(sheets_dir)
        Dir[File.join(sheets_dir, "*.png")].reject { |path| png?(path) }.map do |path|
            FileUtils.rm_f(path)
            File.basename(path)
        end
    end

    # Infos that name a sheet that is missing (or are no JSON): deleted.
    # Returns their tags.
    def self.remove_stale_infos(info_dir, sheets_dir)
        Dir[File.join(info_dir, "*.json")].select do |path|
            sheets = (JSON.parse(File.read(path))["spritesheets"] rescue nil)
            !sheets.is_a?(Array) || sheets.any? { |name| !name.is_a?(String) || !File.exist?(File.join(sheets_dir, File.basename(name))) }
        end.map do |path|
            FileUtils.rm_f(path)
            File.basename(path, ".json")
        end
    end

    # Games written since `since` (nil: all) that have no info.
    def self.games_without_info(games_dir, info_dir, since = nil)
        Dir[File.join(games_dir, "*.json")].select do |path|
            (since.nil? || (File.mtime(path) rescue Time.at(0)) >= since) &&
                !File.exist?(File.join(info_dir, File.basename(path)))
        end.map { |path| File.basename(path, ".json") }
    end

    # places: [{ games_dir:, info_dir:, since: }]; render.call(tag, games_dir, info_dir)
    # makes a game's info (and its sheets). Returns what was done.
    def self.repair(sheets_dir, places, &render)
        report = { broken_sheets: remove_broken_sheets(sheets_dir), rendered: [], failed: [] }
        places.each do |place|
            stale = remove_stale_infos(place[:info_dir], sheets_dir)
            missing = games_without_info(place[:games_dir], place[:info_dir], place[:since])
            (stale + missing).uniq.each do |tag|
                next unless File.exist?(File.join(place[:games_dir], "#{tag}.json"))
                begin
                    render.call(tag, place[:games_dir], place[:info_dir])
                    report[:rendered] << tag
                rescue => e
                    report[:failed] << "#{tag}: #{e}"
                end
            end
        end
        report
    end
end
