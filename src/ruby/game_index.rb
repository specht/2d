# The saved games and how they follow each other, in memory.
#
# Every save is a new version with a tag (content hash, /gen/games/<tag>.json);
# its `parent` is the version it was loaded from, so the versions of a game form
# a tree – a family with one root (the first save) and one or more tips (the
# newest version of each branch). Neo4j stores the same as (:Game)-[:PARENT]->
# (:Game) plus TITLE/AUTHOR strings. Asking Neo4j for all families on every
# "Spiel laden" walks every PARENT path of every game ([:PARENT*0..]) and gets
# slower with each save; this index reads all games once (flat, at start-up, in
# the background), is kept up to date by every save of this process, and
# answers the dialog's questions from memory.
#
# Pure Ruby (no Neo4j, no Sinatra): main.rb feeds it, test/game_index_test.rb
# tests it.
require "set"

class GameIndex
    STATS = %i(ts_created ts_updated size sprite_count state_count frame_count unique_frame_count).freeze
    # titles and authors a family is found by (all its versions), at most this many each
    SEARCH_WORDS = 12

    attr_reader :version

    def initialize
        @mutex = Mutex.new
        @nodes = {}      # tag => { tag:, parent:, title:, author:, ts_created: … }
        @children = {}   # tag => [child tags]
        @journal = nil   # saves and deletions during a load (begin_load … load)
        @ready = false
        @version = 0     # +1 with every change (caches compare it)
    end

    def ready?
        @ready
    end

    def size
        @nodes.size
    end

    # Call before reading all games from the database: saves that arrive
    # while the rows are read are remembered and applied again by load, so
    # a refresh never loses a version saved in the meantime (nor brings back
    # one deleted in the meantime).
    def begin_load
        @mutex.synchronize { @journal = [] }
        self
    end

    # All games at once (start-up, a periodic refresh). rows: hashes with
    # :tag, :parent (or nil), :title, :author and the STATS.
    def load(rows)
        nodes = {}
        rows.each do |row|
            tag = row[:tag].to_s
            next if tag.empty?
            nodes[tag] = clean(row)
        end
        @mutex.synchronize do
            @nodes = nodes
            @children = build_children(nodes)
            journal, @journal = @journal, nil
            (journal || []).each do |kind, value|
                case kind
                when :remove then remove_unlocked(value)
                when :link then link_unlocked(*value)
                else add_unlocked(value)
                end
            end
            @ready = true
            @version += 1
        end
        self
    end

    # One save (main.rb save_game, after Neo4j): like the database, a tag that
    # is there already keeps its creation time and its parent; a parent is only
    # linked when it exists, is not newer and is no descendant (a game can
    # never become its own ancestor). Times are whole seconds: a version saved
    # in the same second as its parent belongs to it, too – a team pressing
    # Speichern one after another did that, and each such save started a
    # family of its own in "Spiel laden" (October 2026).
    def add(row)
        return if row[:tag].to_s.empty?
        @mutex.synchronize do
            @journal << [:add, row] if @journal
            add_unlocked(row)
            @version += 1
        end
    end

    # Versions deleted for good (moderation.rb): gone from every list; a
    # version made from one of them is the first of its family from now on,
    # like after the database lost the PARENT edge.
    def remove(tags)
        tags = tags.map(&:to_s)
        @mutex.synchronize do
            @journal << [:remove, tags] if @journal
            remove_unlocked(tags)
            @version += 1
        end
        self
    end

    def node(tag)
        @mutex.synchronize { @nodes[tag] && @nodes[tag].dup }
    end

    # Versions that the index shows as the first of their family although
    # their saved file names a parent it could have linked (saved in the same
    # second as the parent, before that was allowed): [[tag, parent], …].
    # parent_of(tag) reads the file (nil when there is none). A parent that is
    # gone (deleted by moderation) stays gone.
    def lost_parent_links(&parent_of)
        roots = root_tags
        roots.filter_map do |tag|
            parent = begin
                parent_of.call(tag)
            rescue StandardError
                nil
            end
            next unless parent.is_a?(String)
            @mutex.synchronize { linkable_unlocked?(tag, parent) } ? [tag, parent] : nil
        end
    end

    # Links a version to its parent afterwards (lost_parent_links, once the
    # database has the edge too); false when it cannot be linked.
    def link(tag, parent)
        @mutex.synchronize do
            @journal << [:link, [tag, parent]] if @journal
            linked = link_unlocked(tag, parent)
            @version += 1 if linked
            linked
        end
    end

    # Tags without a (known) parent: the first version of every family.
    def root_tags
        @mutex.synchronize { @nodes.values.select { |n| n[:parent].nil? }.map { |n| n[:tag] } }
    end

    def root_of(tag)
        @mutex.synchronize { root_of_unlocked(tag) }
    end

    # The newest tip of every family whose root is given, newest first, with
    # what the load dialog shows (relatives_count: how many versions the family
    # has) and the titles and authors of all its versions (to search for).
    def tips(roots)
        @mutex.synchronize do
            roots.filter_map do |root|
                next unless @nodes[root]
                family = family_tags_unlocked(root)
                leaves = family.select { |t| (@children[t] || []).empty? }
                tip = leaves.max_by { |t| [@nodes[t][:ts_created] || 0, t] }
                node = @nodes[tip].dup
                node[:relatives_count] = family.size
                node[:root] = root
                node[:family_titles] = family.filter_map { |t| @nodes[t][:title] }.uniq.first(SEARCH_WORDS)
                node[:family_authors] = family.filter_map { |t| @nodes[t][:author] }.uniq.first(SEARCH_WORDS)
                node
            end.sort_by { |n| [-(n[:ts_created] || 0), n[:tag]] }
        end
    end

    # A version and everything before it, newest first (the versions list).
    def ancestors(tag)
        @mutex.synchronize do
            ancestor_tags_unlocked(tag).map { |t| @nodes[t].dup }.sort_by { |n| [-(n[:ts_created] || 0), n[:tag]] }
        end
    end

    # The whole family of a version (every version of its tree), oldest first.
    def family(tag)
        @mutex.synchronize do
            root = root_of_unlocked(tag)
            next [] unless root
            family_tags_unlocked(root).map { |t| @nodes[t].dup }.sort_by { |n| [n[:ts_created] || 0, n[:tag]] }
        end
    end

    # Families with a version whose code starts with, or whose title or author
    # contains, every word of the query; answered with their tips.
    def search(query)
        words = query.to_s.downcase.split(/\s+/).reject(&:empty?)
        return [] if words.empty?
        roots = Set.new
        @mutex.synchronize do
            @nodes.each_value do |n|
                text = "#{n[:title]} #{n[:author]}".downcase
                next unless words.all? { |w| n[:tag].start_with?(w) || text.include?(w) }
                root = root_of_unlocked(n[:tag])
                roots << root if root
            end
        end
        tips(roots.to_a)
    end

    private

    def add_unlocked(row)
        tag = row[:tag].to_s
        node = clean(row)
        old = @nodes[tag]
        if old
            node[:ts_created] = old[:ts_created] || node[:ts_created]
            node[:parent] = old[:parent]
            node[:title] ||= old[:title]
            node[:author] ||= old[:author]
        else
            parent = node[:parent]
            node[:parent] = nil
            @nodes[tag] = node
            link_unlocked(tag, parent)
            return
        end
        @nodes[tag] = node
    end

    # May tag (a version without a parent) become a child of parent?
    def linkable_unlocked?(tag, parent)
        node = @nodes[tag]
        above = parent && @nodes[parent]
        !!(node && above && parent != tag && node[:parent].nil? &&
           (above[:ts_created] || 0) <= (node[:ts_created] || 0) &&
           !ancestor_tags_unlocked(parent).include?(tag))
    end

    def link_unlocked(tag, parent)
        return false unless linkable_unlocked?(tag, parent)
        @nodes[tag][:parent] = parent
        (@children[parent] ||= []) << tag
        true
    end

    def remove_unlocked(tags)
        tags.each do |tag|
            node = @nodes.delete(tag)
            next unless node
            (@children[node[:parent]] || []).delete(tag) if node[:parent]
            (@children.delete(tag) || []).each { |child| @nodes[child][:parent] = nil if @nodes[child] }
        end
    end

    def clean(row)
        node = { tag: row[:tag].to_s, parent: blank(row[:parent]), title: blank(row[:title]), author: blank(row[:author]) }
        STATS.each { |key| node[key] = row[key] }
        node
    end

    def blank(value)
        s = value.to_s
        s.strip.empty? ? nil : s
    end

    # parent → children; a parent that is not known makes its child a root,
    # and a loop (never written by the server) is cut where it closes
    def build_children(nodes)
        nodes.each_value do |n|
            n[:parent] = nil if n[:parent] && (!nodes[n[:parent]] || n[:parent] == n[:tag])
        end
        nodes.each_value do |n|
            seen = Set[n[:tag]]
            p = n[:parent]
            while p
                if seen.include?(p)
                    n[:parent] = nil
                    break
                end
                seen << p
                p = nodes[p][:parent]
            end
        end
        children = {}
        nodes.each_value { |n| (children[n[:parent]] ||= []) << n[:tag] if n[:parent] }
        children
    end

    def root_of_unlocked(tag)
        return nil unless @nodes[tag]
        seen = Set.new
        while (p = @nodes[tag][:parent]) && !seen.include?(p)
            seen << tag
            tag = p
        end
        tag
    end

    def ancestor_tags_unlocked(tag)
        result = []
        seen = Set.new
        while tag && @nodes[tag] && !seen.include?(tag)
            seen << tag
            result << tag
            tag = @nodes[tag][:parent]
        end
        result
    end

    def family_tags_unlocked(root)
        result = []
        queue = [root]
        seen = Set.new
        while (t = queue.shift)
            next if seen.include?(t)
            seen << t
            result << t
            queue.concat(@children[t] || [])
        end
        result
    end
end
