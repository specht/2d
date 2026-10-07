require "minitest/autorun"
require "tmpdir"
require_relative "../src/ruby/moderation"
require_relative "../src/ruby/playtesting"

class ModerationTest < Minitest::Test
    # Records the queries and answers the first one (titles and authors).
    class FakeDatabase
        attr_reader :queries

        def initialize(rows)
            @rows = rows
            @queries = []
        end

        def neo4j_query(query, params = {})
            @queries << [query, params]
            query.include?("RETURN g.tag AS tag") ? @rows.select { |r| params[:tags].include?(r["tag"]) } : []
        end
    end

    def game(title, frames, parent: nil, author: "Ada", extra: {})
        {
            "properties" => { "title" => title, "author" => author },
            "parent" => parent,
            "sprites" => [{ "id" => "sabcdefghij", "properties" => { "name" => "Pip" },
                            "states" => [{ "properties" => { "name" => "laufen", "fps" => 8 },
                                           "frames" => frames.map { |f| { "tag" => f } } }] }],
            "levels" => [{ "id" => "lklmnopqrst", "properties" => { "name" => "Wald", "background_color" => "#000000" },
                           "layers" => [{ "properties" => { "name" => "Ebene 1" },
                                          "sprites" => [["sabcdefghij", 0, 0], ["sabcdefghij", 24, 0, { "text" => { "text" => "Schild" } }]],
                                          "sprite_properties" => { "0" => { "text" => "Hallo Welt" } } }] }],
        }.merge(extra)
    end

    def write_game(tag, data, mtime)
        path = File.join(@gen, "games", "#{tag}.json")
        File.write(path, data.to_json)
        File.utime(mtime, mtime, path)
        frames = Moderation.frames_of(data)
        frames.each { |f| File.write(File.join(@gen, "png", "#{f}.png"), f) }
        sheet = Digest::SHA1.hexdigest(frames.sort.join)[0, 16]
        File.write(File.join(@gen, "spritesheets", "#{sheet}.png"), "sheet")
        File.write(File.join(@gen, "spritesheets", "#{tag}.json"), { "spritesheets" => ["#{sheet}.png"] }.to_json)
        Moderation.catalogue_gifs_of(data).each { |name, _| File.write(File.join(@gen, "catalogue", "#{name}.gif"), "gif") }
    end

    def setup
        @dir = Dir.mktmpdir
        @gen = File.join(@dir, "gen")
        @raw = File.join(@dir, "raw")
        %w(games png spritesheets catalogue graphs).each { |d| FileUtils.mkpath(File.join(@gen, d)) }
        # a ── b (vandalised: a new picture and a word) ── c
        #  └── d (played only, never saved)
        write_game("aaaaaaa", game("Pip", %w(f000001 f000002)), 100)
        write_game("bbbbbbb", game("Pip", %w(f000001 f000002 fbad001), parent: "aaaaaaa",
                                   extra: { "levels" => [{ "properties" => { "name" => "Blöder Wald" } }] }), 200)
        write_game("ccccccc", game("Pip 2", %w(f000001 f000002 fbad001), parent: "bbbbbbb"), 300)
        write_game("ddddddd", game("Pip", %w(f000001 f000003), parent: "aaaaaaa"), 400)
        File.write(File.join(@gen, "graphs", "aaaaaaa.svg"), "<svg>aaaaaaa bbbbbbb ccccccc</svg>")
        File.write(File.join(@gen, "graphs", "zzzzzzz.svg"), "<svg>zzzzzzz xbbbbbbbx</svg>")
        @catalog = Moderation::Catalog.new(@gen).refresh
    end

    def teardown
        FileUtils.rm_rf(@dir)
    end

    def test_normalize_and_terms
        assert_equal "argerlich strasse", Moderation.normalize("Ärgerlich   STRASSE")
        assert_equal "strasse", Moderation.normalize("Straße")
        assert_equal ["blod", "zwei worter", "x"], Moderation.terms('blöd, "zwei Wörter" x BLÖD')
        assert_equal ["zwei worter", "a", "b"], Moderation.terms(["zwei Wörter", "a,b", "A"])
    end

    def test_texts_with_where_they_are
        texts = Moderation.each_text(JSON.parse(File.read(File.join(@gen, "games", "aaaaaaa.json")))).to_a
        assert_includes texts, ["Titel", "Pip"]
        assert_includes texts, ["Sprite 1 »Pip« › Zustand 1 »laufen« › Name", "laufen"]
        assert_includes texts, ["Level 1 »Wald« › Ebene 1 »Ebene 1« › Einstellungen › 0 › Text", "Hallo Welt"]
        assert_includes texts, ["Level 1 »Wald« › Ebene 1 »Ebene 1« › platziertes Sprite 2 › Text › Text", "Schild"]
        # the fast way finds the same texts
        game = JSON.parse(File.read(File.join(@gen, "games", "aaaaaaa.json")))
        assert_equal texts.map(&:last).uniq.sort, Moderation.texts_of(game).sort
        # no frame tags, ids, colours or numbers
        assert texts.none? { |_, t| t =~ /\Af0000|\As[a-z]{10}\z|\A#|\A8\z/ }, texts.inspect
    end

    def test_catalog_search_and_later_versions
        assert_equal 4, @catalog.size
        assert_equal %w(ddddddd ccccccc bbbbbbb aaaaaaa), @catalog.newest_first.map(&:tag)
        found = @catalog.search("blod")
        assert_equal ["bbbbbbb"], found.map { |f| f[:entry].tag }
        assert_equal [{ where: "Level 1 »Blöder Wald« › Name", text: "Blöder Wald", term: "blod" }], found.first[:hits]
        assert_equal %w(ccccccc), @catalog.later_versions("bbbbbbb")
        assert_equal %w(bbbbbbb ddddddd ccccccc), @catalog.later_versions("aaaaaaa")
        assert_equal ["bbbbbbb"], @catalog.resolve("bbbb")
        assert_equal [], @catalog.resolve("bb")
    end

    def test_page_shows_every_picture_and_text_once
        saved = ->(tag) { tag != "ddddddd" }
        page = Moderation.page_games(@catalog, offset: 0, limit: 2, only_new: true, saved: saved)
        assert_equal 4, page[:total]
        assert_equal %w(ddddddd ccccccc), page[:games].map { |g| g[:tag] }
        d, c = page[:games]
        assert_equal false, d[:saved]
        assert_equal %w(f000003), d[:frames]
        assert_equal [], d[:texts]
        # c has nothing new but its title: everything else was shown with a or b
        assert_equal [], c[:frames]
        assert_equal ["Pip 2"], c[:texts]
        b = Moderation.page_games(@catalog, offset: 2, limit: 1, only_new: true)[:games].first
        assert_equal %w(fbad001), b[:frames]
        assert_equal ["Blöder Wald"], b[:texts]
        assert_equal %w(ccccccc), b[:later]
        assert_nil b[:saved]
        a = Moderation.page_games(@catalog, offset: 3, limit: 1, only_new: true)[:games].first
        assert_equal %w(f000001 f000002), a[:frames]
        all = Moderation.page_games(@catalog, offset: 0, limit: 10, only_saved: true, saved: saved)
        assert_equal %w(ccccccc bbbbbbb aaaaaaa), all[:games].map { |g| g[:tag] }
        assert_equal %w(f000001 f000002 fbad001), all[:games].first[:frames]
        found = Moderation.page_search(@catalog, "BLÖD wald")
        assert_equal %w(blod wald), found[:terms]
        assert_equal %w(ddddddd ccccccc bbbbbbb aaaaaaa), found[:games].map { |g| g[:tag] }
        assert_equal %w(bbbbbbb ccccccc), @catalog.with_later_versions(%w(bbbbbbb))
        # deleting the version that showed a picture first shows it with the next one
        @catalog.forget(%w(bbbbbbb))
        assert_equal %w(fbad001), @catalog.novelty("ccccccc")[:frames]
    end

    def test_stream_shows_what_is_new_as_it_is_saved
        # to begin with: the newest versions that show something for the first time
        first = Moderation.page_stream(@catalog, limit: 10)
        assert_equal %w(ddddddd ccccccc bbbbbbb aaaaaaa), first[:games].map { |g| g[:tag] }
        assert_equal %w(fbad001), first[:games][2][:frames]
        # nothing saved since: nothing (the newest one again, its second is asked for)
        assert_equal %w(ddddddd), Moderation.page_stream(@catalog, since: 400)[:games].map { |g| g[:tag] }
        # a new version with a new picture and a new word, and one with nothing new
        write_game("eeeeeee", game("Pip", %w(f000001 fbad002), parent: "ccccccc",
                                   extra: { "levels" => [{ "properties" => { "name" => "Doofer Wald" } }] }), 500)
        write_game("fffffff", game("Pip", %w(f000001 f000002), parent: "aaaaaaa"), 600)
        @catalog.refresh
        live = Moderation.page_stream(@catalog, since: 401)
        assert_equal %w(eeeeeee), live[:games].map { |g| g[:tag] }
        assert_equal %w(fbad002), live[:games].first[:frames]
        assert_equal ["Doofer Wald"], live[:games].first[:texts]
        assert_equal 6, live[:all]
        # a deleted game leaves the stream
        @catalog.forget(%w(eeeeeee))
        assert_equal [], Moderation.page_stream(@catalog, since: 401)[:games]
    end

    def test_pictures_and_texts_of_the_recipes_are_safe
        static = File.join(@dir, "static")
        FileUtils.mkpath(File.join(static, "rezepte", "spiele"))
        png = "PNG des Rezepts"
        recipe = { "sprites" => [{ "states" => [{ "frames" => [{ "src" => "data:image/png;base64,#{Base64.strict_encode64(png)}" }] }] }],
                   "levels" => [{ "properties" => { "name" => "Rezeptlevel" } }] }
        File.write(File.join(static, "rezepte", "spiele", "leiter.json"), recipe.to_json)
        File.write(File.join(static, "rezepte", "katalog.json"), { "gruppen" => [], "spiel" => { "properties" => { "title" => "Sprite-Katalog" } } }.to_json)
        safe = Moderation.recipe_safe(static)
        tag = Moderation.frame_tag(png)
        assert_equal Set[tag], safe[:frames]
        assert_includes safe[:texts], "Rezeptlevel"
        assert_includes safe[:texts], "Sprite-Katalog"
        write_game("eeeeeee", game("Rezeptlevel", [tag, "fnew001"]), 500)
        catalog = Moderation::Catalog.new(@gen, safe: safe).refresh
        assert_equal %w(fnew001), catalog.novelty("eeeeeee")[:frames]
        assert_equal %w(fnew001), catalog.own("eeeeeee")[:frames]
        refute_includes catalog.own("eeeeeee")[:texts], "Rezeptlevel"
        Moderation.delete(%w(eeeeeee), catalog: catalog, raw: @raw)
        assert File.exist?(File.join(@gen, "png", "#{tag}.png"))
        refute File.exist?(File.join(@gen, "png", "fnew001.png"))
    end

    def test_the_cache_keeps_what_was_read
        cache = File.join(@raw, "spiele.cache")
        Moderation::Catalog.new(@gen, cache: cache).refresh
        assert File.exist?(cache)
        # a file read before is not read again (its content never changes)
        File.write(File.join(@gen, "games", "aaaaaaa.json"), "kaputt")
        warm = Moderation::Catalog.new(@gen, cache: cache).refresh
        assert_equal 4, warm.size
        assert_equal "Pip", warm["aaaaaaa"].title
        # a new game is added to the cache, a deleted one forgotten
        write_game("eeeeeee", game("Neu", %w(f000009)), 500)
        File.delete(File.join(@gen, "games", "ddddddd.json"))
        Moderation::Catalog.new(@gen, cache: cache).refresh
        third = Moderation::Catalog.new(@gen, cache: cache).refresh
        assert_equal %w(aaaaaaa bbbbbbb ccccccc eeeeeee), third.entries.map(&:tag).sort
        # a broken cache is simply written anew
        File.write(cache, "kaputt")
        assert_equal 3, Moderation::Catalog.new(@gen, cache: cache).refresh.size
        assert_equal 3, Moderation::Catalog.new(@gen, cache: cache).refresh.size
    end

    def test_web_root
        FileUtils.mkpath(@raw)
        assert_equal "https://env.example", Moderation.web_root(@raw, { "WEB_ROOT" => "https://env.example/" })
        File.write(File.join(@raw, "adresse.txt"), "https://2d.hackschule.de/\n")
        assert_equal "https://2d.hackschule.de", Moderation.web_root(@raw, { "WEB_ROOT" => "https://env.example" })
        File.write(File.join(@raw, "adresse.txt"), "")
        assert_equal "", Moderation.web_root(@raw, {})
        # nothing configured: where the server was reached
        assert_equal true, Moderation.remember_root(@raw, "https://2d.hackschule.de/")
        assert_equal false, Moderation.remember_root(@raw, "https://2d.hackschule.de")
        assert_equal false, Moderation.remember_root(@raw, "not an address")
        assert_equal "https://2d.hackschule.de", Moderation.web_root(@raw, {})
        # configured wins
        assert_equal "https://env.example", Moderation.web_root(@raw, { "WEB_ROOT" => "https://env.example" })
    end

    def test_delete_removes_what_no_other_game_needs
        database = FakeDatabase.new([{ "tag" => "bbbbbbb", "content" => "Pip" }, { "tag" => "bbbbbbb", "content" => "Ada" },
                                     { "tag" => "ccccccc", "content" => "Pip 2" }])
        report = Moderation.delete(%w(bbbbbbb ccccccc), catalog: @catalog, raw: @raw, database: database, reason: "Test")
        gone = ->(path) { !File.exist?(File.join(@gen, path)) }
        assert gone.("games/bbbbbbb.json")
        assert gone.("games/ccccccc.json")
        assert gone.("spritesheets/bbbbbbb.json")
        # the vandal's picture, its sheet and its gif are gone …
        assert gone.("png/fbad001.png")
        assert gone.("spritesheets/#{Digest::SHA1.hexdigest(%w(f000001 f000002 fbad001).join)[0, 16]}.png")
        refute gone.("spritesheets/#{Digest::SHA1.hexdigest(%w(f000001 f000002).join)[0, 16]}.png")
        bad_gif = Moderation.catalogue_gifs_of(game("x", %w(f000001 f000002 fbad001))).first.first
        assert gone.("catalogue/#{bad_gif}.gif")
        assert gone.("graphs/aaaaaaa.svg")
        # … the pictures of the other games stay
        %w(png/f000001.png png/f000002.png png/f000003.png games/aaaaaaa.json games/ddddddd.json graphs/zzzzzzz.svg).each do |path|
            refute gone.(path), path
        end
        good_gif = Moderation.catalogue_gifs_of(game("x", %w(f000001 f000002))).first.first
        refute gone.("catalogue/#{good_gif}.gif")
        assert_equal %w(bbbbbbb ccccccc), report["tags"]
        assert_equal 2, report["in_database"]
        assert_equal 1, report["frames"]
        assert_equal "Test", report["reason"]
        assert(database.queries.any? { |q, p| q.include?("DETACH DELETE") && p[:tags] == %w(bbbbbbb ccccccc) })
        assert(database.queries.any? { |q, p| q.include?("NOT (s)--()") && p[:contents].sort == ["Ada", "Pip", "Pip 2"] })
        assert_nil @catalog["bbbbbbb"]
        # the log tells the server
        tags, offset = Moderation.deleted_since(@raw, 0)
        assert_equal %w(bbbbbbb ccccccc), tags
        assert_equal [[], offset], Moderation.deleted_since(@raw, offset)
        # a line still being written is read once it is complete
        File.open(Moderation.log_path(@raw), "a") { |f| f.write('{"tags":["ddddddd"],"title":"Bä') }
        assert_equal [[], offset], Moderation.deleted_since(@raw, offset)
        File.open(Moderation.log_path(@raw), "a") { |f| f.write("r\"}\n") }
        assert_equal [["ddddddd"], File.size(Moderation.log_path(@raw))], Moderation.deleted_since(@raw, offset)
        assert_equal 2, Moderation.log(@raw).size
    end

    def test_a_broken_game_file_keeps_its_pictures
        File.write(File.join(@gen, "games", "eeeeeee.json"), '{"sprites":[{"states":[{"frames":[{"tag":"fbad001"}]}]}], "x": ')
        report = Moderation.delete(%w(bbbbbbb ccccccc), catalog: @catalog.refresh, raw: @raw)
        assert File.exist?(File.join(@gen, "png", "fbad001.png"))
        assert_equal 0, report["frames"]
    end

    def test_delete_moves_a_playtesting_submission_back
        store = Playtesting::Store.new(File.join(@raw, "playtesting"))
        store.transaction do |state|
            state["submissions"]["s1"] = { "id" => "s1", "tag" => "ccccccc", "tags" => %w(aaaaaaa bbbbbbb ccccccc) }
            state["submissions"]["s2"] = { "id" => "s2", "tag" => "bbbbbbb", "tags" => %w(bbbbbbb) }
            state["submissions"]["s3"] = { "id" => "s3", "tag" => "ddddddd", "tags" => %w(ddddddd) }
        end
        report = Moderation.delete(%w(bbbbbbb ccccccc), catalog: @catalog, raw: @raw, playtesting: store)
        submissions = store.read["submissions"]
        assert_equal "aaaaaaa", submissions["s1"]["tag"]
        assert_equal %w(aaaaaaa), submissions["s1"]["tags"]
        assert submissions["s2"]["withdrawn"]
        refute submissions["s3"]["withdrawn"]
        assert_equal %w(s1 s2), report["playtesting"].sort
    end

    def test_session
        now = Time.at(1_000_000)
        data = Moderation::Session.start(@raw, 30, now)
        assert Moderation::Session.valid?(@raw, data["token"], now + 60)
        refute Moderation::Session.valid?(@raw, data["token"] + "x", now)
        refute Moderation::Session.valid?(@raw, nil, now)
        refute Moderation::Session.valid?(@raw, data["token"], now + 31 * 60)
        Moderation::Session.stop(@raw, "other")
        assert Moderation::Session.valid?(@raw, data["token"], now)
        Moderation::Session.stop(@raw, data["token"])
        refute Moderation::Session.valid?(@raw, data["token"], now)
    end
end
