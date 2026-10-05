require "minitest/autorun"
require_relative "../src/ruby/game_index"

class GameIndexTest < Minitest::Test
    def row(tag, parent, ts, title: "Spiel", author: "Ada")
        { tag: tag, parent: parent, ts_created: ts, ts_updated: ts, size: 100, title: title, author: author,
          sprite_count: 1, state_count: 1, frame_count: 1, unique_frame_count: 1 }
    end

    # a  ── b ── c
    #        └── d        x (alone)    y ── z
    def setup
        @index = GameIndex.new
        @index.load([
            row("aaaaaaa", nil, 10, title: "Pip"),
            row("bbbbbbb", "aaaaaaa", 20, title: "Pip"),
            row("ccccccc", "bbbbbbb", 30, title: "Pip springt"),
            row("ddddddd", "bbbbbbb", 40, title: "Pip taucht", author: "Bo"),
            row("xxxxxxx", nil, 25, title: "Einzeln", author: "Cy"),
            row("yyyyyyy", nil, 5, title: "Alt"),
            row("zzzzzzz", "yyyyyyy", 6, title: "Alt"),
        ])
    end

    def test_ready_and_roots
        assert @index.ready?
        assert_equal 7, @index.size
        assert_equal %w(aaaaaaa xxxxxxx yyyyyyy), @index.root_tags.sort
        assert_equal "aaaaaaa", @index.root_of("ddddddd")
        assert_nil @index.root_of("nope")
    end

    def test_tips_newest_leaf_and_family_size
        tips = @index.tips(@index.root_tags)
        assert_equal %w(ddddddd xxxxxxx zzzzzzz), tips.map { |t| t[:tag] }
        pip = tips.first
        assert_equal 4, pip[:relatives_count]
        assert_equal "aaaaaaa", pip[:root]
        assert_equal ["Pip", "Pip springt", "Pip taucht"], pip[:family_titles]
        assert_equal %w(Ada Bo), pip[:family_authors]
        assert_equal 1, tips[1][:relatives_count]
    end

    def test_ancestors_and_family
        assert_equal %w(ccccccc bbbbbbb aaaaaaa), @index.ancestors("ccccccc").map { |n| n[:tag] }
        assert_equal %w(aaaaaaa bbbbbbb ccccccc ddddddd), @index.family("ccccccc").map { |n| n[:tag] }
        assert_equal [], @index.family("nope")
    end

    def test_search_title_author_and_code
        assert_equal %w(ddddddd), @index.search("springt").map { |n| n[:tag] }
        assert_equal %w(ddddddd), @index.search("bo").map { |n| n[:tag] }
        assert_equal %w(xxxxxxx), @index.search("xxx").map { |n| n[:tag] }
        assert_equal %w(ddddddd), @index.search("PIP ada").map { |n| n[:tag] }
        assert_equal [], @index.search("pip cy")
        assert_equal [], @index.search("   ")
    end

    def test_add_new_version_and_resave
        v = @index.version
        @index.add(row("eeeeeee", "ddddddd", 50, title: "Pip fliegt"))
        assert_operator @index.version, :>, v
        tip = @index.tips(["aaaaaaa"]).first
        assert_equal "eeeeeee", tip[:tag]
        assert_equal 5, tip[:relatives_count]
        # the same content saved again later: keeps creation time and parent
        @index.add(row("eeeeeee", nil, 99, title: "Pip fliegt"))
        node = @index.node("eeeeeee")
        assert_equal 50, node[:ts_created]
        assert_equal "ddddddd", node[:parent]
    end

    def test_add_ignores_unknown_newer_or_own_parent
        @index.add(row("fffffff", "unknown", 60))
        assert_nil @index.node("fffffff")[:parent]
        @index.add(row("ggggggg", "ggggggg", 61))
        assert_nil @index.node("ggggggg")[:parent]
        @index.add(row("hhhhhhh", "ddddddd", 1))
        assert_nil @index.node("hhhhhhh")[:parent]
    end

    def test_load_cuts_unknown_parents_and_loops
        index = GameIndex.new
        index.load([row("p", "q", 1), row("q", "p", 2), row("r", "missing", 3), row("s", "s", 4)])
        assert_equal 3, index.root_tags.size
        tips = index.tips(index.root_tags)
        assert_equal 4, tips.sum { |t| t[:relatives_count] }
    end

    def test_save_during_a_refresh_is_kept
        @index.begin_load
        # the database rows were read before this save arrived
        rows = %w(aaaaaaa bbbbbbb).map { |t| row(t, t == "bbbbbbb" ? "aaaaaaa" : nil, t == "aaaaaaa" ? 10 : 20) }
        @index.add(row("eeeeeee", "bbbbbbb", 70, title: "Neu"))
        @index.load(rows)
        assert_equal "bbbbbbb", @index.node("eeeeeee")[:parent]
        assert_equal "eeeeeee", @index.tips(["aaaaaaa"]).first[:tag]
        # the journal is closed: a later load does not replay it again
        @index.load(rows)
        assert_nil @index.node("eeeeeee")
    end

    def test_blank_title_and_author
        index = GameIndex.new
        index.load([row("a", nil, 1, title: "  ", author: nil)])
        assert_nil index.node("a")[:title]
        assert_equal [], index.tips(["a"]).first[:family_titles]
    end
end
