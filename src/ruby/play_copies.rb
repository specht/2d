# Play copies: Spielen and Level testen play the studio's game as it is,
# without saving it (studio.js → /api/play_copy → the game frame, app.js
# Game.load with play_copy). Only Speichern makes a version.
#
#   <dir>/games/<tag>.json    the game (frames only by their tag, like a saved one)
#   <dir>/sheets/<tag>.json   its sprite sheet info (the sheets themselves are
#                             shared, content-addressed: /gen/spritesheets/<sha>.png)
#
# The directory is below /raw (never served by nginx): a play copy has no code
# anybody can load, no /play link, no place in the game list, a family or
# moderation. The server hands it only to the game frame, by its tag, and
# forgets it KEEP_DAYS days after it was last played. Its pictures go to
# /gen/png like every game's (content-addressed, shared).
#
# Pure Ruby; tested in test/play_copies_test.rb.
require "fileutils"

module PlayCopies
    TAG = /\A[a-z0-9]{7}\z/
    KEEP_DAYS = 7
    # how often a save looks for old copies (seconds)
    PRUNE_EVERY = 3600

    def self.games_dir(dir) = File.join(dir, "games")
    def self.sheets_dir(dir) = File.join(dir, "sheets")

    def self.game_path(dir, tag) = tag.to_s =~ TAG ? File.join(games_dir(dir), "#{tag}.json") : nil
    def self.sheets_path(dir, tag) = tag.to_s =~ TAG ? File.join(sheets_dir(dir), "#{tag}.json") : nil

    # Played again (the same content, the same tag): kept from now on.
    def self.touch(dir, tag, now = Time.now)
        [game_path(dir, tag), sheets_path(dir, tag)].each do |path|
            File.utime(now, now, path) if path && File.exist?(path)
        end
    end

    # Copies not played for KEEP_DAYS days are deleted (game and sheet info).
    # Returns the tags.
    def self.prune(dir, now = Time.now, days: KEEP_DAYS)
        limit = now - days * 24 * 3600
        old = Dir[File.join(games_dir(dir), "*.json")].select { |path| (File.mtime(path) rescue now) < limit }
        old.map do |path|
            tag = File.basename(path, ".json")
            FileUtils.rm_f(path)
            FileUtils.rm_f(sheets_path(dir, tag)) if sheets_path(dir, tag)
            tag
        end
    end

    # The file of a copy to hand to the game frame, or nil.
    def self.read(dir, tag, part = :game)
        path = part == :sheets ? sheets_path(dir, tag) : game_path(dir, tag)
        path && File.exist?(path) ? File.read(path) : nil
    end
end
