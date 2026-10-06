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
                                          "sprites" => [[0, 0, "sabcdefghij"]],
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

    def test_page_lists_newest_first_with_what_is_new
        saved = ->(tag) { tag != "ddddddd" }
        page = Moderation.page_games(@catalog, offset: 0, limit: 2, only_new: true, saved: saved)
        assert_equal 4, page[:total]
        assert_equal %w(ddddddd ccccccc), page[:games].map { |g| g[:tag] }
        d, c = page[:games]
        assert_equal false, d[:saved]
        assert_equal %w(f000003), d[:frames]
        assert_equal [], c[:frames]
        # b had another level: its texts are new again in c
        assert_equal ["Pip 2", "Wald", "Ebene 1", "Hallo Welt"], c[:texts]
        b = Moderation.page_games(@catalog, offset: 2, limit: 1, only_new: true)[:games].first
        assert_equal %w(fbad001), b[:frames]
        assert_equal %w(ccccccc), b[:later]
        assert_nil b[:saved]
        all = Moderation.page_games(@catalog, offset: 0, limit: 10, only_saved: true, saved: saved)
        assert_equal %w(ccccccc bbbbbbb aaaaaaa), all[:games].map { |g| g[:tag] }
        assert_equal %w(f000001 f000002 fbad001), all[:games].first[:frames]
        found = Moderation.page_search(@catalog, "BLÖD wald")
        assert_equal %w(blod wald), found[:terms]
        assert_equal %w(ddddddd ccccccc bbbbbbb aaaaaaa), found[:games].map { |g| g[:tag] }
        assert_equal %w(bbbbbbb ccccccc), @catalog.with_later_versions(%w(bbbbbbb))
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
