# Moderation: finding games that have to go (vandalism: words or pictures that
# need no discussion) and removing them for good – from the disk, the database
# and every cache. Used by moderate.rb in the terminal and by the temporary
# moderation page (main.rb, moderation.html) that `./moderate.rb web` opens.
#
# What a saved game leaves behind (all of it content-addressed, so pictures
# and sheets may be shared with other games):
#
#   /gen/games/<tag>.json          the game (frames only by their tag)
#   /gen/png/<frame>.png           one picture per frame (shared)
#   /gen/spritesheets/<tag>.json   the game's sheets (rendered on load/save)
#   /gen/spritesheets/<sha>.png    a sheet (shared by games with the same pictures)
#   /gen/catalogue/<sha>.gif       a state as a gif (update-catalogue.rb)
#   /gen/graphs/<root>.svg         a family drawn by render-graph.rb
#   Neo4j (:Game {tag}) with its PARENT/TITLE/AUTHOR edges, (:String) for titles
#   and authors; the server's GameIndex in memory; playtesting submissions
#
# Deleting removes the game's own files and every shared file that no other
# game needs any more. Every deletion is written to /raw/moderation/geloescht.jsonl;
# the server reads new lines from it and drops the games from its index, so a
# deletion in the terminal reaches the load dialog at once.
#
# Pure Ruby (no Neo4j, no Sinatra): the database comes in as an object with
# neo4j_query(query, params). Tested in test/moderation_test.rb.
require "digest"
require "fileutils"
require "json"
require "openssl"
require "securerandom"
require "set"
require "time"

module Moderation
    TAG = /\A[a-z0-9]{7}\z/
    # keys whose strings are no text of the child: frame tags, data URLs, ids
    SKIP_KEYS = %w(tag src id parent).freeze
    KEY_LABELS = { "title" => "Titel", "author" => "Autor:in", "name" => "Name", "label" => "Name",
                   "text" => "Text", "traits" => "Eigenschaften", "sprite_properties" => "Einstellungen" }.freeze
    LIST_LABELS = { "states" => "Zustand", "levels" => "Level", "layers" => "Ebene", "frames" => "Bild",
                    "conditions" => "Bedingung", "rects" => "Rechteck" }.freeze
    MAX_HITS_PER_GAME = 30

    def self.log_path(dir) = File.join(dir, "geloescht.jsonl")

    # Lower case, without accents, ß as ss, spaces collapsed: "Ärger" finds
    # "ärger", "ARGER" and "Ärger".
    def self.normalize(text)
        s = text.to_s
        s = s.dup.force_encoding(Encoding::UTF_8) unless s.encoding == Encoding::UTF_8
        s = s.scrub("")
        s = s.unicode_normalize(:nfkd).gsub(/\p{Mn}/, "") rescue s
        s.downcase.gsub("ß", "ss").gsub(/\s+/, " ")
    end

    # Search words. From the page (a string): "a, b" and "a b" both give two
    # words, "\"zwei Wörter\"" stays one. From the command line (a list):
    # every argument is one (the shell's quotes), commas still separate.
    def self.terms(input)
        list = if input.is_a?(Array)
            input.flat_map { |s| s.to_s.split(/[,;]/) }
        else
            input.to_s.scan(/"([^"]+)"|([^\s,;"]+)/).map { |a, b| a || b }
        end
        list.map { |t| normalize(t).strip }.reject(&:empty?).uniq
    end

    # Every text of a game with where it is ("Sprite 3 »Pip« › Zustand 2 › Name").
    # Yields [where, text].
    def self.each_text(game)
        return enum_for(:each_text, game) unless block_given?
        ids = Set.new
        %w(sprites levels).each do |key|
            list = game.is_a?(Hash) ? game[key] : nil
            (list.is_a?(Array) ? list : []).each { |item| ids << item["id"] if item.is_a?(Hash) && item["id"].is_a?(String) }
        end
        walk(game, [], nil, false, ids) { |where, text| yield where.join(" › "), text }
    end

    def self.item_name(item)
        return nil unless item.is_a?(Hash)
        name = item.dig("properties", "name") if item["properties"].is_a?(Hash)
        name = item["label"] if !name.is_a?(String) || name.strip.empty?
        name = item["name"] if !name.is_a?(String) || name.strip.empty?
        name.is_a?(String) && !name.strip.empty? ? name.strip : nil
    end

    def self.walk(value, where, key, in_layer, ids, &block)
        case value
        when String
            text = value.strip
            return if text.empty? || ids.include?(text) || text =~ /\A#\h{3,8}\z/ || text =~ /\A-?\d+(\.\d+)?\z/
            block.call(where, value)
        when Array
            value.each_with_index do |item, i|
                word = if key == "sprites"
                    in_layer ? "platziertes Sprite" : "Sprite"
                else
                    LIST_LABELS[key] || KEY_LABELS[key] || key || "Eintrag"
                end
                name = item_name(item)
                label = "#{word} #{i + 1}#{name ? " »#{name}«" : ''}"
                walk(item, where + [label], nil, in_layer || key == "layers", ids, &block)
            end
        when Hash
            value.each do |k, v|
                next if SKIP_KEYS.include?(k)
                if v.is_a?(Array)
                    walk(v, where, k, in_layer, ids, &block)
                elsif k == "properties"
                    walk(v, where, nil, in_layer, ids, &block)
                else
                    walk(v, where + [KEY_LABELS[k] || k], nil, in_layer, ids, &block)
                end
            end
        end
    end

    # The frame tags of a game, each once, in order.
    def self.frames_of(game)
        frames = []
        (game["sprites"] || []).each do |sprite|
            next unless sprite.is_a?(Hash)
            (sprite["states"] || []).each do |state|
                next unless state.is_a?(Hash)
                (state["frames"] || []).each { |f| frames << f["tag"] if f.is_a?(Hash) && f["tag"].is_a?(String) }
            end
        end
        frames.uniq
    end

    # The gifs update-catalogue.rb makes of a game's states, with their frames:
    # [[name, [frame tags]], …] (same naming as there).
    def self.catalogue_gifs_of(game)
        result = []
        (game["sprites"] || []).each do |sprite|
            next unless sprite.is_a?(Hash)
            (sprite["states"] || []).each do |state|
                next unless state.is_a?(Hash)
                frames = (state["frames"] || []).map { |f| f.is_a?(Hash) ? f["tag"] : nil }.compact
                fps = (state["properties"] || {})["fps"] || 8
                config = { :tags => frames.map { |t| "/gen/png/#{t}.png" }, :fps => fps }
                result << [Digest::SHA1.hexdigest(config.to_json)[0, 12], frames]
            end
        end
        result
    end

    # ------------------------------------------------ all games on the disk

    # What moderation needs to know of every game file (saved or only played),
    # read once and then only what is new: a tag's content never changes.
    class Catalog
        Entry = Struct.new(:tag, :parent, :title, :author, :time, :frames, :texts, :search, keyword_init: true)

        attr_reader :gen

        def initialize(gen = "/gen")
            @gen = gen
            @entries = {}
            @mutex = Mutex.new
            @refresh_mutex = Mutex.new
            @progress = nil
        end

        def games_dir = File.join(@gen, "games")

        # [done, total] while a refresh reads files, else nil
        def progress = @progress

        def size = @mutex.synchronize { @entries.size }

        # Reads new game files and forgets deleted ones. Yields (done, total)
        # now and then while it reads.
        def refresh
            @refresh_mutex.synchronize do
                names = Dir.exist?(games_dir) ? Dir.children(games_dir) : []
                tags = names.filter_map { |n| n.end_with?(".json") && (t = n[0..-6]) =~ TAG ? t : nil }.to_set
                known = @mutex.synchronize { @entries.keys.to_set }
                fresh = (tags - known).to_a
                @mutex.synchronize { (known - tags).each { |t| @entries.delete(t) } }
                fresh.each_with_index do |tag, i|
                    if i % 200 == 0
                        @progress = [i, fresh.size]
                        yield i, fresh.size if block_given?
                    end
                    entry = read_entry(tag)
                    @mutex.synchronize { @entries[tag] = entry } if entry
                end
                @progress = nil
                yield fresh.size, fresh.size if block_given? && !fresh.empty?
            end
            self
        end

        def read_entry(tag)
            path = File.join(games_dir, "#{tag}.json")
            game = JSON.parse(File.read(path))
            return nil unless game.is_a?(Hash)
            properties = game["properties"].is_a?(Hash) ? game["properties"] : {}
            texts = Moderation.each_text(game).map { |_, text| text }.uniq
            Entry.new(tag: tag, parent: game["parent"].is_a?(String) && game["parent"] != tag ? game["parent"] : nil,
                      title: properties["title"].is_a?(String) ? properties["title"] : nil,
                      author: properties["author"].is_a?(String) ? properties["author"] : nil,
                      time: File.mtime(path).to_i, frames: Moderation.frames_of(game), texts: texts,
                      search: texts.map { |t| Moderation.normalize(t) }.join("\n"))
        rescue StandardError
            nil
        end

        def [](tag) = @mutex.synchronize { @entries[tag] }
        def entries = @mutex.synchronize { @entries.values }

        # A tag or a unique start of one (at least four letters).
        def resolve(prefix)
            prefix = prefix.to_s.strip.downcase
            return [prefix] if prefix =~ TAG && self[prefix]
            return [] if prefix.size < 4
            @mutex.synchronize { @entries.keys.select { |t| t.start_with?(prefix) } }
        end

        # Newest first (when the file was written: the first save or play).
        def newest_first
            entries.sort_by { |e| [-e.time, e.tag] }
        end

        def children
            map = Hash.new { |h, k| h[k] = [] }
            entries.each { |e| map[e.parent] << e.tag if e.parent }
            map
        end

        # Every version made from this one later on (the game file's parent:
        # also copies that were only played), without the tag itself.
        def later_versions(tag, children = self.children)
            result = []
            queue = children[tag].dup
            seen = Set[tag]
            while (t = queue.shift)
                next if seen.include?(t)
                seen << t
                result << t
                queue.concat(children[t])
            end
            result
        end

        # The tags and every version made from them later on.
        def with_later_versions(tags)
            children = self.children
            (tags + tags.flat_map { |t| later_versions(t, children) }).uniq
        end

        # Games with a text that contains one of the terms, with where:
        # [{ entry:, hits: [{ where:, text:, term: }] }], newest first.
        def search(terms)
            terms = Moderation.terms(terms)
            return [] if terms.empty?
            newest_first.filter_map do |entry|
                next unless terms.any? { |t| entry.search.include?(t) }
                { entry: entry, hits: hits(entry.tag, terms) }
            end
        end

        def hits(tag, terms)
            game = JSON.parse(File.read(File.join(games_dir, "#{tag}.json")))
            result = []
            Moderation.each_text(game) do |where, text|
                norm = Moderation.normalize(text)
                term = terms.find { |t| norm.include?(t) }
                result << { where: where, text: text, term: term } if term
                break if result.size >= MAX_HITS_PER_GAME
            end
            result
        rescue StandardError
            []
        end

        def forget(tags)
            @mutex.synchronize { tags.each { |t| @entries.delete(t) } }
        end
    end

    # ------------------------------------------------ deleting

    # Removes games for good. tags: the versions (nothing else is added – the
    # caller decides about later versions). database: an object with
    # neo4j_query or nil; playtesting: a Playtesting::Store or nil. Returns
    # what was removed. The database goes first: if it cannot be reached,
    # nothing is deleted.
    def self.delete(tags, catalog:, raw:, database: nil, playtesting: nil, by: "Terminal", reason: nil, now: Time.now)
        gen = catalog.gen
        catalog.refresh
        tags = tags.map(&:to_s).select { |t| t =~ TAG }.uniq
        games = tags.filter_map do |tag|
            path = File.join(gen, "games", "#{tag}.json")
            game = (JSON.parse(File.read(path)) rescue nil)
            [tag, game.is_a?(Hash) ? game : {}] if File.exist?(path)
        end.to_h
        in_database = tags
        if database
            rows = database.neo4j_query(<<~END_OF_QUERY, { :tags => in_database })
                MATCH (g:Game) WHERE g.tag IN $tags
                OPTIONAL MATCH (g)-[:TITLE|AUTHOR]->(s:String)
                RETURN g.tag AS tag, s.content AS content;
            END_OF_QUERY
            rows = rows.to_a
            contents = rows.map { |r| r["content"] }.compact.uniq
            in_database = rows.map { |r| r["tag"] }.uniq
            database.neo4j_query("MATCH (g:Game) WHERE g.tag IN $tags DETACH DELETE g;", { :tags => in_database }) unless in_database.empty?
            database.neo4j_query(<<~END_OF_QUERY, { :contents => contents }) unless contents.empty?
                MATCH (s:String) WHERE s.content IN $contents AND NOT (s)--() DELETE s;
            END_OF_QUERY
        else
            in_database = []
        end
        gone = tags.to_set
        # pictures no other game uses any more
        remaining_frames = Set.new
        catalog.entries.each { |e| remaining_frames.merge(e.frames) unless gone.include?(e.tag) }
        # a game file the catalog does not know (saved just now, half written,
        # broken) keeps every picture its text names
        games_dir = File.join(gen, "games")
        (Dir.exist?(games_dir) ? Dir.children(games_dir) : []).each do |name|
            next unless name.end_with?(".json")
            tag = name[0..-6]
            next if gone.include?(tag) || catalog[tag]
            text = (File.read(File.join(games_dir, name)) rescue "")
            remaining_frames.merge(text.scan(/"tag"\s*:\s*"([a-z0-9]+)"/).flatten)
        end
        frames = games.values.flat_map { |g| frames_of(g) }.uniq.reject { |f| remaining_frames.include?(f) }
        # sheets of these games no other game's sheets list
        sheet_dir = File.join(gen, "spritesheets")
        own_sheets = Set.new
        other_sheets = Set.new
        (Dir.exist?(sheet_dir) ? Dir.children(sheet_dir) : []).each do |name|
            next unless name.end_with?(".json")
            # by the text, so a file being written still keeps its sheets
            text = (File.read(File.join(sheet_dir, name)) rescue "")
            (gone.include?(name[0..-6]) ? own_sheets : other_sheets).merge(text.scan(/[0-9a-f]{16}\.png/))
        end
        sheets = (own_sheets - other_sheets).to_a
        # a gif with a picture that is gone belongs to no other game
        frame_set = frames.to_set
        gifs = games.values.flat_map { |g| catalogue_gifs_of(g) }.select { |_, f| f.any? { |t| frame_set.include?(t) } }.map(&:first).uniq
        graph_dir = File.join(gen, "graphs")
        graphs = (Dir.exist?(graph_dir) ? Dir.children(graph_dir) : []).select do |name|
            name.end_with?(".svg") && (text = (File.read(File.join(graph_dir, name)) rescue "")) &&
                tags.any? { |t| text =~ /(?<![a-z0-9])#{t}(?![a-z0-9])/ }
        end
        existing = ->(list, path) { list.select { |x| File.exist?(path.call(x)) } }
        frames = existing.call(frames, ->(f) { File.join(gen, "png", "#{f}.png") })
        sheets = existing.call(sheets, ->(s) { File.join(sheet_dir, File.basename(s)) })
        gifs = existing.call(gifs, ->(g) { File.join(gen, "catalogue", "#{g}.gif") })
        files = tags.flat_map { |t| [File.join(gen, "games", "#{t}.json"), File.join(sheet_dir, "#{t}.json")] } +
                frames.map { |f| File.join(gen, "png", "#{f}.png") } +
                sheets.map { |s| File.join(sheet_dir, File.basename(s)) } +
                gifs.map { |g| File.join(gen, "catalogue", "#{g}.gif") } +
                graphs.map { |g| File.join(graph_dir, g) }
        removed = files.select { |path| File.exist?(path) }
        # playtesting and the log before the files: if one of them fails, the
        # deletion is still told to the server (and can simply be repeated)
        submissions = begin
            playtesting ? withdraw(playtesting, gone) : []
        rescue StandardError => e
            ["Fehler: #{e.message}"]
        end
        report = {
            "time" => now.utc.iso8601, "by" => by, "reason" => reason.to_s.strip.empty? ? nil : reason.to_s.strip[0, 200],
            "tags" => tags,
            "games" => tags.map do |t|
                p = games[t] && games[t]["properties"].is_a?(Hash) ? games[t]["properties"] : {}
                { "tag" => t, "title" => p["title"], "author" => p["author"], "parent" => games[t] && games[t]["parent"] }
            end,
            "in_database" => in_database.size, "frames" => frames.size, "sheets" => sheets.size, "gifs" => gifs.size,
            "files" => removed.size, "playtesting" => submissions,
        }
        FileUtils.mkpath(raw)
        File.open(log_path(raw), "a") { |f| f.write("#{report.to_json}\n") }
        removed.each { |path| FileUtils.rm_f(path) }
        catalog.forget(tags)
        report
    end

    # Playtesting: a submission whose tested version is gone goes back to its
    # newest version that is left, or out of the round when none is.
    def self.withdraw(store, gone)
        concerned = store.read["submissions"].values.any? { |s| gone.include?(s["tag"]) || (s["tags"] || []).any? { |t| gone.include?(t) } }
        return [] unless concerned
        store.transaction do |state|
            state["submissions"].values.filter_map do |s|
                before = s["tags"] || []
                next unless gone.include?(s["tag"]) || before.any? { |t| gone.include?(t) }
                s["tags"] = before.reject { |t| gone.include?(t) }
                if gone.include?(s["tag"])
                    if s["tags"].empty?
                        s["withdrawn"] = true
                    else
                        s["tag"] = s["tags"].last
                    end
                end
                s["id"]
            end
        end
    end

    # Tags deleted after a byte offset of the log (the server follows it).
    def self.deleted_since(raw, offset)
        path = log_path(raw)
        return [[], 0] unless File.exist?(path)
        tags = []
        size = File.size(path)
        return [[], offset] if size == offset
        offset = 0 if offset > size
        File.open(path, "rb") do |f|
            f.seek(offset)
            text = f.read.to_s
            # a line still being written is read next time
            complete = text.rindex("\n")
            return [[], offset] unless complete
            text[0..complete].each_line do |line|
                entry = (JSON.parse(line.force_encoding(Encoding::UTF_8)) rescue nil)
                tags.concat(entry["tags"]) if entry.is_a?(Hash) && entry["tags"].is_a?(Array)
            end
            [tags.uniq, offset + text[0..complete].bytesize]
        end
    end

    def self.log(raw)
        path = log_path(raw)
        return [] unless File.exist?(path)
        File.readlines(path).filter_map { |line| JSON.parse(line) rescue nil }
    end

    # ------------------------------------------------ the temporary page

    # One version as the page shows it. only_new: just the pictures and texts
    # its parent did not have. saved: tag → true/false (in the database), or
    # nil when that is not known.
    def self.page_entry(catalog, entry, children, only_new, saved)
        parent = entry.parent && catalog[entry.parent]
        {
            :tag => entry.tag, :parent => parent ? entry.parent : nil, :title => entry.title, :author => entry.author,
            :time => entry.time, :saved => saved ? saved.call(entry.tag) : nil,
            :frames => only_new && parent ? entry.frames - parent.frames : entry.frames, :frame_count => entry.frames.size,
            :texts => (only_new && parent ? entry.texts - parent.texts : entry.texts).first(300), :text_count => entry.texts.size,
            :later => catalog.later_versions(entry.tag, children),
        }
    end

    # Newest first, a page of them. only_new: versions without new pictures or
    # texts are left out; only_saved: versions that were only played (needs saved).
    def self.page_games(catalog, offset: 0, limit: 30, only_new: false, only_saved: false, saved: nil)
        children = catalog.children
        list = catalog.newest_first.select do |entry|
            next false if only_saved && saved && !saved.call(entry.tag)
            next true unless only_new
            parent = entry.parent && catalog[entry.parent]
            parent.nil? || !(entry.frames - parent.frames).empty? || !(entry.texts - parent.texts).empty?
        end
        offset = [offset.to_i, 0].max
        games = list[offset, limit.to_i.clamp(1, 100)].to_a.map { |entry| page_entry(catalog, entry, children, only_new, saved) }
        { :total => list.size, :all => catalog.size, :offset => offset, :games => games }
    end

    # The word search on the page: the newest 200 games found, with where.
    def self.page_search(catalog, query, saved: nil)
        terms = terms(query.to_s[0, 500])
        children = catalog.children
        found = catalog.search(terms)
        games = found.first(200).map { |f| page_entry(catalog, f[:entry], children, false, saved).merge(:hits => f[:hits]) }
        { :terms => terms, :total => found.size, :all => catalog.size, :games => games }
    end

    # `./moderate.rb web` opens the page for a while: a random token in
    # /raw/moderation/sitzung.json (not served), the page's link carries it.
    module Session
        def self.path(raw) = File.join(raw, "sitzung.json")

        def self.start(raw, minutes, now = Time.now)
            FileUtils.mkpath(raw)
            token = SecureRandom.urlsafe_base64(24)
            data = { "token" => token, "started_at" => now.to_i, "expires_at" => now.to_i + minutes * 60 }
            File.open(path(raw), File::WRONLY | File::CREAT | File::TRUNC, 0o600) { |f| f.write(data.to_json) }
            data
        end

        def self.current(raw, now = Time.now)
            data = JSON.parse(File.read(path(raw)))
            data.is_a?(Hash) && data["token"].is_a?(String) && data["expires_at"].to_i > now.to_i ? data : nil
        rescue StandardError
            nil
        end

        def self.valid?(raw, token, now = Time.now)
            data = current(raw, now)
            return false unless data && token.is_a?(String) && token.bytesize == data["token"].bytesize
            OpenSSL.fixed_length_secure_compare(token, data["token"])
        end

        def self.stop(raw, token)
            data = (JSON.parse(File.read(path(raw))) rescue nil)
            FileUtils.rm_f(path(raw)) if data.is_a?(Hash) && data["token"] == token
        end
    end
end
