require "base64"
require "chunky_png"
require "date"
require "digest"
require "faye/websocket"
Faye::WebSocket.load_adapter("thin")
require 'fileutils'
require "json"
require "neo4j_bolt"
require "sinatra/base"
require "sinatra/cookies"
require 'vips'
require_relative "collaboration"
require_relative "client_errors"
require_relative "playtesting"
require_relative "game_index"
require_relative "moderation"
require_relative "play_copies"
require_relative "sheet_repair"

DASHBOARD_SERVICE = ENV["DASHBOARD_SERVICE"]
DEVELOPMENT = ENV['DEVELOPMENT'] == '1'
# Live collaboration is on unless env.rb sets COLLABORATION = false.
COLLABORATION_ENABLED = ENV['COLLABORATION'] != '0'
# Private: holds session codes and reconnect tokens. /raw is not served by nginx
# (unlike /gen), so this file never reaches a browser.
COLLABORATION_SESSIONS_PATH = "/raw/collaboration/sessions.json"
# Fehlerberichte from the studio (client_errors.rb, crash_report.js), one file
# per day. Private like the sessions: /raw is not served.
CLIENT_ERRORS_PATH = "/raw/client-errors"
# The game of a Fehlerbericht (crash_report.js): kept with the reports (errors.rb
# prunes and clears them together), loaded only by the teacher (/?<code>).
CLIENT_ERROR_GAMES_PATH = ClientErrors.games_dir(CLIENT_ERRORS_PATH)

# Spielen and Level testen: the copy of the studio's game that the game frame
# plays (play_copies.rb). Private: /raw is not served.
PLAY_COPIES_PATH = "/raw/play"

# Playtesting in the classroom (playtesting.rb, switched on and off with
# playtest.rb in the terminal). Private like the sessions: /raw is not served.
PLAYTESTING_PATH = "/raw/playtesting"

# Moderation (moderation.rb, moderate.rb in the terminal): the log of deleted
# games and the session of the temporary moderation page. Private: /raw is not
# served.
MODERATION_PATH = "/raw/moderation"

# The saved games in memory (game_index.rb), read again from Neo4j this often
# (seconds). Saves of this process update it at once; the refresh only picks up
# what was written elsewhere (a loaded dump, a cleared database).
GAME_INDEX_REFRESH = 15 * 60

Neo4jBolt.bolt_host = "neo4j"
Neo4jBolt.bolt_port = 7687

# ANIMALS = %w(🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐒 🐧 🐦 🦆 🦅 🦉 🦇 🐴 🦄 🐝 🦋 🐌 🐞 🪲 🦗 🐢 🐍 🦎 🐙 🦀 🐠 🐬 🐋 🐊 🐅 🦓 🐘 🐪 🦒 🦘 🐄 🐖 🐑 🐐 🐕 🐈‍⬛ 🐓 🦚 🦜 🦢 🦩 🐇 🐁 🦔)
ANIMALS = %w(s1cfi07 rqaux7w q6xbd0g pxly0tu on87yoe n0vdqui lm78e76 lclapq1 l3lawv5 l2ozijf l2d1t8l l0v66o3 kp11rle k2ram59 jzp6ovu
    jq70giy irath30 hj6vqa0 gdbl86r ga56q6n g54ebrx g8ceaya ffg1kv8 f4jizb6 e2z9poi aob22o8 ako2wyi a7oqxgh a2r8to1 114g99w
    49v6ivw 9g4gu5z 7zl61mu 7hmau5i 6iwskal 4r9nct2 4nyev3o 4j8mqjo)

SPRITESHEET_FACTOR = 4
MAX_SPRITESHEET_WIDTH = 1024
MAX_SPRITESHEET_HEIGHT = 1024

def debug(message, index = 0)
    index = 0
    begin
        while index < caller_locations.size - 1 && ["transaction", "neo4j_query", "neo4j_query_expect_one"].include?(caller_locations[index].base_label)
            index += 1
        end
    rescue
        index = 0
    end
    l = caller_locations[index]
    ls = ""
    begin
        ls = "#{l.path.sub("/app/", "")}:#{l.lineno} @ #{l.base_label}"
    rescue
        ls = "#{l[0].sub("/app/", "")}:#{l[1]}"
    end
    STDERR.puts "#{DateTime.now.strftime("%H:%M:%S")} [#{ls}] #{message}"
end

def debug_error(message)
    l = caller_locations.first
    ls = ""
    begin
        ls = "#{l.path.sub("/app/", "")}:#{l.lineno} @ #{l.base_label}"
    rescue
        ls = "#{l[0].sub("/app/", "")}:#{l[1]}"
    end
    STDERR.puts "#{DateTime.now.strftime("%H:%M:%S")} [ERROR] [#{ls}] #{message}"
end

class Neo4jGlobal
    include Neo4jBolt
end

$neo4j = Neo4jGlobal.new

class RandomTag
    BASE_31_ALPHABET = "0123456789bcdfghjklmnpqrstvwxyz"
    def self.to_base31(i)
        result = ""
        while i > 0
            result += BASE_31_ALPHABET[i % 31]
            i /= 31
        end
        result
    end

    def self.generate(length = 12)
        self.to_base31(SecureRandom.hex(length).to_i(16))[0, length]
    end
end

class SetupDatabase
    include Neo4jBolt

    def setup(main)
        wait_for_neo4j
        delay = 1
        10.times do
            begin
                neo4j_query("MATCH (n) RETURN n LIMIT 1;")
                break unless ENV["SERVICE"] == "ruby"
                # every save, load and version list looks games up by tag
                # and strings by content: without these, each is a full scan
                neo4j_query("CREATE INDEX game_tag IF NOT EXISTS FOR (g:Game) ON (g.tag);")
                neo4j_query("CREATE INDEX string_content IF NOT EXISTS FOR (s:String) ON (s.content);")
                debug "Setup finished."
                break
            rescue
                debug $!
                debug "Retrying setup after #{delay} seconds..."
                sleep delay
                delay += 1
            end
        end
    end
end

# Reads every saved game for the GameIndex (game_index.rb): four flat scans
# instead of following PARENT paths. Older saves wrote TITLE, AUTHOR and PARENT
# edges with CREATE, so a game saved twice may have the same edge twice; the
# smallest value wins, which keeps the result the same on every run.
class GameIndexLoader
    include Neo4jBolt

    def rows
        games = {}
        neo4j_query(<<~END_OF_QUERY).each do |row|
            MATCH (g:Game)
            RETURN g.tag AS tag, g.ts_created AS ts_created, g.ts_updated AS ts_updated,
                   g.size AS size, g.sprite_count AS sprite_count, g.state_count AS state_count,
                   g.frame_count AS frame_count, g.unique_frame_count AS unique_frame_count;
        END_OF_QUERY
            next unless row['tag']
            game = { :tag => row['tag'] }
            GameIndex::STATS.each { |key| game[key] = row[key.to_s] }
            games[row['tag']] = game
        end
        { :parent => "MATCH (g:Game)-[:PARENT]->(o:Game) RETURN g.tag AS tag, o.tag AS value;",
          :title => "MATCH (g:Game)-[:TITLE]->(o:String) RETURN g.tag AS tag, o.content AS value;",
          :author => "MATCH (g:Game)-[:AUTHOR]->(o:String) RETURN g.tag AS tag, o.content AS value;",
        }.each_pair do |key, query|
            neo4j_query(query).each do |row|
                game = games[row['tag']]
                value = row['value']
                next unless game && value.is_a?(String)
                game[key] = value if game[key].nil? || value < game[key]
            end
        end
        games.values
    ensure
        cleanup_neo4j
    end
end

# The PARENT edges a save could not write (game_index.rb lost_parent_links):
# until October 2026 a version saved in the same second as its parent got no
# edge, and every such save of a team showed up as a game of its own.
class ParentLinkWriter
    include Neo4jBolt

    # links: [[tag, parent], …]; returns those the database took
    def write(links)
        links.select do |tag, parent|
            neo4j_query(<<~END_OF_QUERY, { :tag => tag, :parent => parent }).to_a.any?
                MATCH (g:Game {tag: $tag})
                MATCH (p:Game {tag: $parent})
                WHERE p.ts_created <= g.ts_created AND NOT (g)-[:PARENT]->(:Game)
                MERGE (g)-[:PARENT]->(p)
                RETURN g.tag AS tag;
            END_OF_QUERY
        end
    ensure
        cleanup_neo4j
    end
end

class Main < Sinatra::Base
    include Neo4jBolt
    helpers Sinatra::Cookies

    if COLLABORATION_ENABLED
        @@collaboration_store = Collaboration::Store.new(
            max_sessions: (ENV['COLLABORATION_MAX_SESSIONS'] || Collaboration::Store::DEFAULT_MAX_SESSIONS).to_i,
        )
        @@collaboration_join_attempts = Collaboration::AttemptLimiter.new
        @@collaboration_sockets = Hash.new { |hash, code| hash[code] = {} }
        @@collaboration_sockets_mutex = Mutex.new

        # Sessions outlive a restart of this process (a deploy, or a code
        # reload in development): written every 30 s when something changed,
        # and once more on a regular shutdown.
        begin
            restored = @@collaboration_store.restore_from(COLLABORATION_SESSIONS_PATH)
            debug "Restored #{restored} collaboration session(s)" if restored > 0
        rescue => e
            debug_error "Could not restore collaboration sessions: #{e}"
        end
        Thread.new do
            loop do
                sleep 30
                begin
                    @@collaboration_store.persist_to(COLLABORATION_SESSIONS_PATH)
                rescue => e
                    debug_error "Could not persist collaboration sessions: #{e}"
                end
            end
        end
        at_exit do
            begin
                @@collaboration_store.persist_to(COLLABORATION_SESSIONS_PATH, force: true)
            rescue => e
                STDERR.puts "Could not persist collaboration sessions: #{e}"
            end
        end
    end

    configure do
        set :show_exceptions, false
    end

    @@game_index = GameIndex.new
    @@game_list_cache = nil
    @@game_list_cache_mutex = Mutex.new
    # how far the log of deleted games has been read (moderation.rb): what was
    # deleted before this start is not in the database any more anyway
    @@moderation_log_offset = File.size?(Moderation.log_path(MODERATION_PATH)) || 0
    @@moderation_log_mutex = Mutex.new
    # all game files, read while the moderation page is open
    @@moderation_catalog = nil
    @@moderation_catalog_mutex = Mutex.new

    def self.refresh_game_index
        t0 = Time.now
        @@game_index.begin_load
        @@game_index.load(GameIndexLoader.new.rows)
        debug "Game index: #{@@game_index.size} versions in #{(Time.now - t0).round(2)} s"
    end

    # Read all games once in the background right after start-up, so the
    # first "Spiel laden" is already answered from memory, and again every
    # GAME_INDEX_REFRESH seconds. Until the first read is done, the requests
    # ask Neo4j as before.
    # Once when the server starts (sheet_repair.rb): sheets that are no
    # picture, infos that name a missing sheet, and recent games and play
    # copies without an info are rendered again.
    # It starts while this file is still being read (configure, below): it
    # waits until the renderer further down is there.
    def self.repair_spritesheets
        50.times { break if Main.respond_to?(:render_spritesheet_for_tag); sleep 0.1 }
        report = SheetRepair.repair("/gen/spritesheets", [
            { games_dir: "/gen/games", info_dir: "/gen/spritesheets", since: Time.now - 14 * 24 * 3600 },
            { games_dir: PlayCopies.games_dir(PLAY_COPIES_PATH), info_dir: PlayCopies.sheets_dir(PLAY_COPIES_PATH), since: nil },
        ]) { |tag, games_dir, info_dir| Main.render_spritesheet_for_tag(tag, games_dir: games_dir, info_dir: info_dir) }
        if report.values.any?(&:any?)
            STDERR.puts "Sprite sheets repaired: #{report[:broken_sheets].size} broken sheet(s) removed, " +
                "#{report[:rendered].size} game(s) rendered again, #{report[:failed].size} failed"
            report[:failed].first(20).each { |line| STDERR.puts "  #{line}" }
        end
    rescue => e
        STDERR.puts "Sprite sheet repair: #{e}"
    end

    # Once after the first read of all games: versions that lost their parent
    # (saved in the same second, game_index.rb) are linked again, from the
    # parent their saved file names. Changes nothing when there are none.
    def self.repair_parent_links(games_dir = "/gen/games")
        lost = @@game_index.lost_parent_links do |tag|
            next nil unless tag =~ /\A[a-z0-9]+\z/
            path = File.join(games_dir, "#{tag}.json")
            File.exist?(path) ? JSON.parse(File.read(path))["parent"] : nil
        end
        return if lost.empty?
        written = ParentLinkWriter.new.write(lost)
        # the load dialog's list follows (its cache knows the index's version)
        written.each { |tag, parent| @@game_index.link(tag, parent) }
        STDERR.puts "Game versions linked to their parent again: #{written.size} of #{lost.size}"
    rescue => e
        STDERR.puts "Parent link repair: #{e}"
    end

    def self.start_game_index
        Thread.new do
            delay = 5
            repaired = false
            loop do
                begin
                    refresh_game_index
                    unless repaired
                        repaired = true
                        repair_parent_links
                    end
                    delay = 5
                    sleep GAME_INDEX_REFRESH
                rescue => e
                    debug_error "Could not read the game index: #{e}"
                    sleep delay
                    delay = [delay * 2, 300].min
                end
            end
        end
    end

    def self.collect_data
        $neo4j.wait_for_neo4j
    end

    # The studio's version: a digest of its code (scripts, styles, pages,
    # shaders, JSON such as rezepte.json). It is the cache buster of every
    # versioned URL, and /api/ping tells it to open pages (server_watch.js):
    # after a restart with changed files they offer to reload, after a restart
    # without changes nothing happens and browsers keep their caches. Falls
    # back to a random tag if the files cannot be read.
    def self.static_digest(root = "/static")
        files = Dir.glob(File.join(root, "**", "*.{js,css,html,fs,vs,json}")).reject { |path| path.include?("/node_modules/") }.sort
        return nil if files.empty?
        digest = Digest::SHA1.new
        files.each do |path|
            digest << path.sub(root, "") << "\0" << File.binread(path) << "\0"
        end
        digest.hexdigest.to_i(16).to_s(36)[0, 12]
    rescue => e
        STDERR.puts "Could not compute the studio's version: #{e}"
        nil
    end

    configure do
        @@cache_buster = Main.static_digest || RandomTag.generate()
        @@client_error_limiter = ClientErrors::Limiter.new
        @@play_copies_pruned_at = 0
        self.collect_data() unless defined?(SKIP_COLLECT_DATA) && SKIP_COLLECT_DATA
        if ENV["SERVICE"] == "ruby" && (File.basename($0) == "thin" || File.basename($0) == "pry.rb")
            setup = SetupDatabase.new()
            setup.setup(self)
            Main.start_game_index
            # in the background: the studio is there at once
            Thread.new { Main.repair_spritesheets }
        end
        @@playtesting = Playtesting::Store.new(PLAYTESTING_PATH)
        if ["thin", "rackup"].include?(File.basename($0))
            debug("Server is up and running!")
        end
        if ENV["SERVICE"] == "ruby" && File.basename($0) == "pry.rb"
            binding.pry
        end
    end

    def assert(condition, message = "assertion failed", suppress_backtrace = false, delay = nil)
        unless condition
            debug_error message
            e = StandardError.new(message)
            e.set_backtrace([]) if suppress_backtrace
            sleep delay unless delay.nil?
            raise e
        end
    end

    def assert_with_delay(condition, message = "assertion failed", suppress_backtrace = false)
        assert(condition, message, suppress_backtrace, 3.0)
    end

    def test_request_parameter(data, key, options)
        type = ((options[:types] || {})[key]) || String
        assert(data[key.to_s].is_a?(type), "#{key.to_s} is a #{type} (it's a #{data[key.to_s].class})")
        if type == String
            assert(data[key.to_s].size <= (options[:max_value_lengths][key] || options[:max_string_length]), "too_much_data")
        end
    end

    def parse_request_data(options = {})
        options[:max_body_length] ||= 512
        options[:max_string_length] ||= 512
        options[:required_keys] ||= []
        options[:optional_keys] ||= []
        options[:max_value_lengths] ||= {}
        data_str = request.body.read(options[:max_body_length]).to_s
        @latest_request_body = data_str.dup
        begin
            assert(data_str.is_a? String)
            assert(data_str.size < options[:max_body_length], "too_much_data")
            data = JSON::parse(data_str)
            @latest_request_body_parsed = data.dup
            result = {}
            options[:required_keys].each do |key|
                assert(data.include?(key.to_s))
                test_request_parameter(data, key, options)
                result[key.to_sym] = data[key.to_s]
            end
            options[:optional_keys].each do |key|
                if data.include?(key.to_s)
                    test_request_parameter(data, key, options)
                    result[key.to_sym] = data[key.to_s]
                end
            end
            result
        rescue
            debug "Request was:"
            debug data_str
            raise
        end
    end

    before "*" do
        @latest_request_body = nil
        @latest_request_body_parsed = nil
    end

    after "/api/*" do
        if @respond_content
            response.body = @respond_content
            response.headers["Content-Type"] = @respond_mimetype
            if @respond_filename
                response.headers["Content-Disposition"] = "attachment; filename=\"#{@respond_filename}\""
            end
        else
            @respond_hash ||= {}
            response.body = @respond_hash.to_json
        end
    end

    def respond(hash = {})
        @respond_hash = hash
    end

    def respond_raw_with_mimetype(content, mimetype)
        @respond_content = content
        @respond_mimetype = mimetype
    end

    def respond_raw_with_mimetype_and_filename(content, mimetype, filename)
        @respond_content = content
        @respond_mimetype = mimetype
        @respond_filename = filename
    end

    # server_watch.js asks every few seconds: is the server there, and which
    # version of the studio does it serve?
    post "/api/ping" do
        Main.remember_web_root(request.base_url)
        playtest = @@playtesting.read
        enabled = playtest["enabled"] == true
        playtest_seen_ping if enabled
        # the Playtesting tab follows (playtesting.js set_enabled): on, and testing or still submitting
        respond(:pong => "yay", :version => @@cache_buster, :playtest => enabled, :playtest_testing => playtest["testing"] == true)
    end

    # Playtesting: who has the studio open (the moderation page's class list).
    # The ping brings { playtest: { browser, who: { tester, session, author },
    # session } }: when it was seen and in which session is kept here (lost on
    # a restart, back within a ping); the names go to the file
    # (playtesting.rb remember_browser), only when they change. A child in the
    # session of a submitted game becomes one of its team – also one who joins
    # late and never opens the Playtesting tab.
    @@playtest_seen = {}
    @@playtest_seen_mutex = Mutex.new

    def playtest_seen_ping
        body = (JSON.parse(request.body.read(8 * 1024).to_s) rescue nil)
        info = body.is_a?(Hash) ? body["playtest"] : nil
        return unless info.is_a?(Hash)
        browser = info["browser"]
        return unless browser.is_a?(String) && browser =~ /\A[a-z0-9]{8,40}\z/
        session = info["session"].is_a?(String) && info["session"] =~ /\A[A-Z0-9]{4,12}\z/ ? info["session"] : nil
        now = Time.now
        @@playtest_seen_mutex.synchronize do
            @@playtest_seen.delete_if { |_, seen| now - seen[:at] > 3600 }
            @@playtest_seen[browser] = { :at => now, :session => session }
        end
        @@playtesting.remember_browser(browser, info["who"])
        playtest_join_team({ :browser => browser, :session => session }) if session
    rescue StandardError => e
        debug_error "Playtesting ping: #{e}"
    end

    # Where the studio is reached (scheme and host as the browser sees them;
    # Rack reads X-Forwarded-Proto of the proxy in front): the host of the link
    # ./moderate.rb web prints when env.rb names none (moderation.rb web_root).
    @@seen_web_root = nil
    def self.remember_web_root(root)
        return if @@seen_web_root == root
        @@seen_web_root = root
        Moderation.remember_root(MODERATION_PATH, root)
    rescue StandardError
        nil
    end

    # A Fehlerbericht from the studio (crash_report.js): appended to the day's
    # file under /raw/client-errors (client_errors.rb, errors.rb).
    post "/api/report_error" do
        data = parse_request_data(:required_keys => [:report], :types => { :report => Hash }, :max_body_length => 64 * 1024)
        client = request.env["HTTP_X_CLIENT_IP"] || request.ip || "unknown"
        if @@client_error_limiter.allow?(client)
            begin
                ClientErrors.append(CLIENT_ERRORS_PATH, ClientErrors.entry(data[:report]))
            rescue => e
                STDERR.puts "Could not write a client error report: #{e}"
            end
        end
        respond(:ok => true)
    end

    if COLLABORATION_ENABLED
        # Live collaboration: src/ruby/collaboration.rb keeps the sessions,
        # src/static/collaboration.js is the studio side. Every participant has
        # one WebSocket; messages are small JSON operations. Applied operations
        # are broadcast to everybody in the session (including the sender, as
        # confirmation); rejected ones are answered to the sender only.

        def collaboration_send(socket, payload)
            collaboration_send_raw(socket, payload.to_json)
        end

        def collaboration_send_raw(socket, json)
            socket.send(json)
        rescue => e
            debug "Could not send collaboration message: #{e}"
        end

        # Returns the socket this participant used before, if it is replaced.
        def collaboration_register_socket(code, participant_id, connection_id, socket)
            @@collaboration_sockets_mutex.synchronize do
                previous = @@collaboration_sockets[code][participant_id]
                @@collaboration_sockets[code][participant_id] = {
                    :connection_id => connection_id,
                    :socket => socket,
                }
                previous && previous[:connection_id] != connection_id ? previous[:socket] : nil
            end
        end

        # The socket of a participant that was removed (a copy of oneself): it
        # is told why and closed, so that tab ends instead of reconnecting.
        def collaboration_close_removed(code, participant_id)
            entry = @@collaboration_sockets_mutex.synchronize do
                sockets = @@collaboration_sockets.fetch(code, {})
                sockets.delete(participant_id)
            end
            return unless entry
            collaboration_send(entry[:socket], :type => "error", :error => "removed", :fatal => true)
            entry[:socket].close(4012, "removed")
        rescue => e
            debug "Could not close a removed participant: #{e}"
        end

        def collaboration_unregister_socket(code, participant_id, connection_id)
            @@collaboration_sockets_mutex.synchronize do
                sockets = @@collaboration_sockets.fetch(code, {})
                entry = sockets[participant_id]
                if entry && entry[:connection_id] == connection_id
                    sockets.delete(participant_id)
                end
                @@collaboration_sockets.delete(code) if sockets.empty?
            end
        end

        # The payload is serialized once and the same JSON goes to everybody.
        def collaboration_broadcast(code, payload)
            json = payload.to_json
            sockets = @@collaboration_sockets_mutex.synchronize do
                @@collaboration_sockets.fetch(code, {}).values.map { |entry| entry[:socket] }
            end
            sockets.each { |socket| collaboration_send_raw(socket, json) }
        end

        def collaboration_broadcast_presence(code, participants)
            collaboration_broadcast(code, { :type => "presence", :participants => participants })
        end

        def collaboration_snapshot_payload(type, snapshot, extra = {})
            {
                :type => type,
                :code => snapshot[:code],
                :source_tag => snapshot[:source_tag],
                :revision => snapshot[:revision],
                :saved_revision => snapshot[:saved_revision],
                :resource_revisions => snapshot[:resource_revisions],
                :state => snapshot[:state],
                :participants => snapshot[:participants],
            }.merge(extra)
        end

        # The client's address as nginx reports it (X-Client-IP, see config.rb).
        def collaboration_client_key
            request.env["HTTP_X_CLIENT_IP"] || request.ip || "unknown"
        end

        def collaboration_string(value)
            value.is_a?(String) && value.size <= 200 ? value : nil
        end

        # A normal save stores the palette the saver has selected; a shared
        # save does the same with the palette of whoever clicked save.
        def collaboration_palette(value)
            return nil unless value.is_a?(Array) && value.length.between?(1, 256)
            return nil unless value.all? { |color| color.is_a?(String) && color.match?(/\A#[0-9a-fA-F]{3,8}\z/) }
            value
        end

        # Does the saved version keep this palette (nil: none sent)? Only then
        # is an unchanged shared save the same version.
        def collaboration_saved_palette?(tag, palette, games_dir = "/gen/games")
            return false unless tag.is_a?(String) && tag =~ /\A[a-z0-9]+\z/
            return true if palette.nil?
            path = File.join(games_dir, "#{tag}.json")
            File.exist?(path) && JSON.parse(File.read(path))["palette"] == palette
        rescue
            false
        end

        def collaboration_save(socket, code, ids, palette = nil)
            prepared = @@collaboration_store.begin_save(**ids)
            unless prepared
                collaboration_send(socket, :type => "save_error", :error => "save_in_progress")
                return
            end

            begin
                game_to_save = prepared[:state]
                game_to_save["parent"] = prepared[:source_tag]
                game_to_save["palette"] = palette if palette
                if prepared[:unchanged] && collaboration_saved_palette?(prepared[:source_tag], palette)
                    # nothing changed since the last shared save (the whole
                    # team presses Speichern): that version again, no copy of it
                    tag = prepared[:source_tag]
                else
                    tag = save_game(game_to_save, true)
                    # a submitted game: this version is tested from now on (as with /api/save_game)
                    begin
                        @@playtesting.after_save(tag, { "properties" => game_to_save["properties"], "parent" => prepared[:source_tag] })
                    rescue => e
                        STDERR.puts "Playtesting after shared save: #{e}"
                    end
                end
                saved = @@collaboration_store.finish_save(
                    :code => code,
                    :token => prepared[:token],
                    :tag => tag,
                )
                collaboration_broadcast(code, {
                    :type => "saved",
                    :tag => tag,
                    :icon => icon_for_tag(tag),
                    :saved_by => prepared[:participant_name],
                    :saved_by_id => prepared[:participant_id],
                    :source_tag => saved[:source_tag],
                    :revision => saved[:revision],
                    :saved_revision => saved[:saved_revision],
                    :participants => saved[:participants],
                })
            rescue => e
                @@collaboration_store.abort_save(:code => code, :token => prepared[:token])
                debug_error "Shared collaboration save failed: #{e}"
                collaboration_send(socket, :type => "save_error", :error => "save_failed")
            end
        end

        def handle_collaboration_message(socket, code, participant_id, connection_id, message)
            ids = { :code => code, :participant_id => participant_id, :connection_id => connection_id }
            type = message["type"]
            case type
            when "heartbeat"
                result = @@collaboration_store.touch(**ids)
                collaboration_broadcast_presence(code, result[:participants]) if result[:expired]
            when "request_snapshot"
                snapshot = @@collaboration_store.snapshot(:code => code)
                collaboration_send(socket, collaboration_snapshot_payload("snapshot", snapshot))
            when "remove"
                # a copy of oneself left behind (collaboration.rb remove)
                target_id = collaboration_string(message["participant_id"])
                result = @@collaboration_store.remove(**ids, :target_id => target_id)
                if result[:removed]
                    collaboration_close_removed(code, target_id)
                    collaboration_broadcast_presence(code, result[:participants])
                else
                    collaboration_send(socket, {
                        :type => "rejected", :request => "remove", :reason => result[:reason],
                        :participants => result[:participants],
                    })
                end
            when "lock", "unlock"
                resource = collaboration_string(message["resource"])
                result = if type == "lock"
                    @@collaboration_store.lock(**ids, :resource => resource)
                else
                    @@collaboration_store.unlock(**ids, :resource => resource)
                end
                if result[:applied]
                    collaboration_broadcast_presence(code, result[:participants])
                else
                    collaboration_send(socket, {
                        :type => "rejected",
                        :request => type,
                        :resource => resource,
                        :reason => result[:reason],
                        :participants => result[:participants],
                    })
                end
            when "update"
                resource = collaboration_string(message["resource"])
                result = @@collaboration_store.update(
                    **ids,
                    :resource => resource,
                    :resource_revision => message["resource_revision"],
                    :value => message["value"],
                )
                if result[:applied]
                    collaboration_broadcast(code, {
                        :type => "update",
                        :revision => result[:revision],
                        :resource => result[:resource],
                        :resource_revision => result[:resource_revision],
                        :value => result[:value],
                        :participant_id => participant_id,
                    })
                else
                    collaboration_send(socket, {
                        :type => "rejected",
                        :request => "update",
                        :resource => resource,
                        :reason => result[:reason],
                        :resource_revision => result[:resource_revision],
                        :value => result[:value],
                    })
                end
            when "insert", "delete", "move"
                kind = collaboration_string(message["kind"])
                id = collaboration_string(message["id"])
                after_id = collaboration_string(message["after_id"])
                result = if type == "insert"
                    @@collaboration_store.insert(**ids, :kind => kind, :value => message["value"], :after_id => after_id)
                elsif type == "delete"
                    @@collaboration_store.delete(**ids, :kind => kind, :id => id)
                else
                    @@collaboration_store.move(**ids, :kind => kind, :id => id, :after_id => after_id)
                end
                payload = result.reject { |key, _value| key == :applied }
                if result[:applied]
                    collaboration_broadcast(code, payload.merge(:type => "structure"))
                else
                    collaboration_send(socket, payload.merge(:type => "rejected", :request => type))
                end
            when "save"
                collaboration_save(socket, code, ids, collaboration_palette(message["palette"]))
            else
                collaboration_send(socket, :type => "error", :error => "unknown_message", :fatal => false)
            end
        end

        post "/api/collaboration/create" do
            data = parse_request_data(
                :required_keys => [:game],
                :optional_keys => [:source_tag],
                :types => { :game => Hash, :source_tag => String },
                :max_value_lengths => { :source_tag => 64 },
                :max_body_length => 1024 * 1024 * 20,
            )
            begin
                snapshot = @@collaboration_store.create(
                    :state => data[:game],
                    :source_tag => data[:source_tag],
                    :creator => collaboration_client_key,
                )
                respond(
                    :code => snapshot[:code],
                    :revision => snapshot[:revision],
                )
            rescue Collaboration::TooManySessions, Collaboration::InvalidGame => e
                status(e.is_a?(Collaboration::TooManySessions) ? 503 : 400)
                respond(:error => e.message)
            end
        end

        get "/collaboration/:code" do
            unless Faye::WebSocket.websocket?(request.env)
                status 426
                return "WebSocket required"
            end

            code = params[:code].to_s.upcase
            client_key = collaboration_client_key
            socket = Faye::WebSocket.new(request.env, nil, :ping => 30)
            participant_id = nil
            connection_id = nil

            socket.on :message do |event|
                begin
                    if event.data.bytesize > 1024 * 1024 * 20
                        collaboration_send(socket, :type => "error", :error => "too_much_data", :fatal => true)
                        socket.close(4009, "too_much_data")
                        next
                    end
                    message = JSON.parse(event.data)
                    raise JSON::ParserError, "not an object" unless message.is_a?(Hash)

                    if participant_id.nil?
                        unless message["type"] == "join"
                            collaboration_send(socket, :type => "error", :error => "join_required", :fatal => true)
                            socket.close(4008, "join_required")
                            next
                        end
                        if @@collaboration_join_attempts.blocked?(client_key)
                            raise Collaboration::TooManyAttempts, "too_many_attempts"
                        end
                        begin
                            joined = @@collaboration_store.join(
                                :code => code,
                                :name => message["name"],
                                :participant_id => collaboration_string(message["participant_id"]),
                                :reconnect_token => collaboration_string(message["reconnect_token"]),
                            )
                        rescue Collaboration::SessionNotFound
                            @@collaboration_join_attempts.failure!(client_key)
                            raise
                        end
                        participant_id = joined[:participant_id]
                        connection_id = joined[:connection_id]
                        replaced = collaboration_register_socket(code, participant_id, connection_id, socket)
                        # The same participant joined again (after a dropped
                        # connection, or from a duplicated tab): the old
                        # connection must not keep acting for it.
                        replaced&.close(4010, "replaced")
                        collaboration_send(
                            socket,
                            collaboration_snapshot_payload(
                                "welcome",
                                joined[:snapshot],
                                :participant_id => participant_id,
                                :reconnect_token => joined[:reconnect_token],
                            ),
                        )
                        collaboration_broadcast_presence(code, joined[:snapshot][:participants])
                        next
                    end

                    handle_collaboration_message(socket, code, participant_id, connection_id, message)
                rescue JSON::ParserError
                    collaboration_send(socket, :type => "error", :error => "invalid_json", :fatal => false)
                rescue Collaboration::Error => e
                    collaboration_send(socket, :type => "error", :error => e.message, :fatal => true)
                    socket.close(4008, e.message)
                rescue => e
                    debug_error "Collaboration WebSocket error: #{e}"
                    collaboration_send(socket, :type => "error", :error => "internal_error", :fatal => true)
                    socket.close(4011, "internal_error")
                end
            end

            socket.on :close do |_event|
                if participant_id && connection_id
                    @@collaboration_store.leave(
                        :code => code,
                        :participant_id => participant_id,
                        :connection_id => connection_id,
                    )
                    collaboration_unregister_socket(code, participant_id, connection_id)
                    collaboration_broadcast_presence(code, @@collaboration_store.participants(:code => code))
                end
            end

            socket.rack_response
        end
    end

    # games_dir: where the game is; info_dir: where its sheet info goes (the
    # sheets themselves are shared: /gen/spritesheets/<sha>.png)
    def self.render_spritesheet_for_tag(tag, games_dir: "/gen/games", info_dir: "/gen/spritesheets")
        path = "#{info_dir}/#{tag}.json"
        # done already – unless a sheet it names is gone or no picture (sheet_repair.rb)
        return if SheetRepair.info_ok?(path, "/gen/spritesheets")
        # debug "Rendering spritesheet for #{tag}!"
        FileUtils.mkpath(File.dirname(path))
        game = JSON.parse(File.read("#{games_dir}/#{tag}.json"))
        sprite_sizes = {}
        sprite_paths = {}
        game["sprites"].each.with_index do |sprite, si|
            sprite["states"].each.with_index do |state, sti|
                state["frames"].each.with_index do |frame, fi|
                    png_path = "/gen/png/#{frame["tag"]}.png"
                    frame = ChunkyPNG::Image.from_file(png_path)
                    key = "#{si}/#{sti}/#{fi}"
                    sprite_sizes[key] = [frame.width + 2, frame.height + 2]
                    sprite_paths[key] = png_path
                end
            end
        end
        frames_by_height = sprite_sizes.keys.sort do |a, b|
            sprite_sizes[b][1] <=> sprite_sizes[a][1]
        end
        sprite_positions = {}
        sheets = []
        sheet_contents = []
        x = 0
        y = 0
        ny = nil
        sheet = nil
        r = 0
        frames_by_height.each do |key|
            r += 1
            break if r > 10
            ny ||= y + sprite_sizes[key][1]
            if ny > MAX_SPRITESHEET_HEIGHT
                # debug "next spritesheet!"
                x = 0
                y = 0
                ny = nil
                sheet = nil
                redo
            end
            nx = x + sprite_sizes[key][0]
            if nx > MAX_SPRITESHEET_WIDTH
                # debug "next row!"
                x = 0
                y = ny
                ny = nil
                redo
            end
            r = 0
            if sheet.nil?
                sheet = ChunkyPNG::Image.new(MAX_SPRITESHEET_WIDTH, MAX_SPRITESHEET_HEIGHT, ChunkyPNG::Color::TRANSPARENT)
                sheets << sheet
                sheet_contents << []
            end

            frame = ChunkyPNG::Image.from_file(sprite_paths[key])
            # left
            sheets.last.replace!(frame.crop(0, 0, 1, frame.height), x, y + 1)
            # right
            sheets.last.replace!(frame.crop(frame.width - 1, 0, 1, frame.height), x + frame.width + 1, y + 1)
            # top
            sheets.last.replace!(frame.crop(0, 0, frame.width, 1), x + 1, y)
            # bottom
            sheets.last.replace!(frame.crop(0, frame.height - 1, frame.width, 1), x + 1, y + frame.height + 1)
            # top left
            sheets.last.replace!(frame.crop(0, 0, 1, 1), x, y)
            # top right
            sheets.last.replace!(frame.crop(frame.width - 1, 0, 1, 1), x + frame.width + 1, y)
            # bottom left
            sheets.last.replace!(frame.crop(0, frame.height - 1, 1, 1), x, y + frame.height + 1)
            # bottom right
            sheets.last.replace!(frame.crop(frame.width - 1, frame.height - 1, 1, 1), x + frame.width + 1, y + frame.height + 1)
            # center
            sheets.last.replace!(frame, x + 1, y + 1)
            sprite_positions[key] = [sheets.size - 1, (x + 1) * SPRITESHEET_FACTOR, (y + 1) * SPRITESHEET_FACTOR]
            sheet_contents.last << [key, x, y, File.basename(sprite_paths[key])]
            x = nx
        end
        # debug sheet_contents.to_yaml
        info = {
            :spritesheets => [],
        }
        sheets.each.with_index do |sheet, i|
            sheet_sha1 = Digest::SHA1.hexdigest(sheet_contents[i].to_json)[0, 16]
            # its own name: `path` is where the info goes (below)
            sheet_path = "/gen/spritesheets/#{sheet_sha1}.png"
            # a sheet that is no picture (sheet_repair.rb) is made again
            unless File.exist?(sheet_path) && SheetRepair.png?(sheet_path)
                sheet.save(sheet_path + 's', :fast_rgba)
                im = Vips::Image.new_from_file sheet_path + 's'
                im = im.resize(4, :kernel => :nearest)
                im.pngsave(sheet_path)
                FileUtils.rm_f(sheet_path + 's')
            end
            info[:spritesheets] << "#{sheet_sha1}.png"
        end
        tiles = []
        game["sprites"].each.with_index do |sprite, si|
            tiles << []
            sprite["states"].each.with_index do |state, sti|
                tiles.last << []
                state["frames"].each.with_index do |frame, fi|
                    key = "#{si}/#{sti}/#{fi}"
                    tiles.last.last << sprite_positions[key]
                end
            end
        end
        info[:tiles] = tiles
        info[:width] = MAX_SPRITESHEET_WIDTH * SPRITESHEET_FACTOR
        info[:height] = MAX_SPRITESHEET_HEIGHT * SPRITESHEET_FACTOR
        # written next to it and renamed: nobody reads half an info
        File.write(path + ".tmp", info.to_json)
        File.rename(path + ".tmp", path)
    end

    def icon_for_tag(tag)
        ANIMALS[tag.to_i(36) % ANIMALS.size]
    end

    # ------------------------------------------------ Playtesting
    # (playtesting.rb; the studio side is src/static/playtesting.js)

    def playtest_request(*keys)
        data = parse_request_data(:required_keys => [:browser], :optional_keys => keys + [:session, :open_tag],
                                  :types => { :answers => Hash }, :max_body_length => 16 * 1024,
                                  :max_value_lengths => { :name => 80, :tag => 16, :assignment => 32, :session => 16, :open_tag => 16, :code => 16 })
        assert(data[:browser].is_a?(String) && data[:browser] =~ /\A[a-z0-9]{8,40}\z/, "bad_browser")
        data
    end

    # A browser in a live session sends its code: the session's game (from
    # the session, never from what the browser says) is its team's game.
    def playtest_session_tag(data)
        return nil unless COLLABORATION_ENABLED && data[:session].is_a?(String) && data[:session] =~ /\A[A-Z0-9]{4,12}\z/
        @@collaboration_store.source_tag(:code => data[:session])
    rescue StandardError
        nil
    end

    # ... and joins it, if that game is submitted (written only then).
    def playtest_join_team(data)
        tag = playtest_session_tag(data)
        return unless tag
        submission = Playtesting.submission_with_tag(@@playtesting.read, tag)
        return if submission.nil? || Playtesting.team?(submission, data[:browser])
        @@playtesting.transaction { |state| Playtesting.join_team(state, data[:browser], tag) }
    end

    post "/api/playtest/status" do
        data = playtest_request
        playtest_join_team(data)
        respond(Playtesting.status(@@playtesting.read, data[:browser], open_tag: data[:open_tag]))
    end

    # The class code (playtesting.rb): { code } – wrong guesses are counted per
    # address (a whole school may share one, so it is generous)
    @@playtest_code_attempts = Collaboration::AttemptLimiter.new(max_failures: 40, window: 10 * 60)

    post "/api/playtest/join" do
        data = playtest_request(:code)
        client = request.env["HTTP_X_CLIENT_IP"] || request.ip || "unknown"
        return respond(:error => "too_many_attempts") if @@playtest_code_attempts.blocked?(client)
        error = @@playtesting.transaction { |state| Playtesting.join_class(state, data[:browser], data[:code]) }
        @@playtest_code_attempts.failure!(client) if error
        respond(error ? { :error => error } : Playtesting.status(@@playtesting.read, data[:browser]))
    end

    # The game with this tag (just saved by the studio) is submitted.
    post "/api/playtest/submit" do
        data = playtest_request(:tag)
        tag = data[:tag].to_s
        assert(tag =~ /\A[a-z0-9]{7}\z/ && File.exist?("/gen/games/#{tag}.json"), "unknown_game")
        game = JSON.parse(File.read("/gen/games/#{tag}.json"))
        # a team member in its session is in the class by that (join_team)
        playtest_join_team(data)
        submission, error, already = @@playtesting.transaction do |state|
            Playtesting.in_class?(state, data[:browser]) ? Playtesting.submit(state, tag, game, data[:browser]) : [nil, "code_needed"]
        end
        playtest_join_team(data) unless error
        # already: somebody of the team submitted it before – no second entry
        respond(error ? { :error => error } : { :submission => submission.slice("id", "title", "tag", "author"), :already => already })
    end

    post "/api/playtest/next" do
        data = playtest_request(:name)
        team_tag = playtest_session_tag(data)
        result, error = @@playtesting.transaction do |state|
            # never the own team's game
            Playtesting.join_team(state, data[:browser], team_tag) if team_tag
            # a test under way goes on (after a reload, also once the testing ended);
            # a new one only while the testing runs, and only with a game in the round
            running = Playtesting.running_for(state, data[:browser])
            refused = running ? nil : (Playtesting.in_class?(state, data[:browser]) ? Playtesting.may_test(state, data[:browser]) : "code_needed")
            next [nil, refused] if refused
            assignment = running || Playtesting.next_assignment(state, data[:browser], data[:name].to_s)
            [assignment ? Playtesting.assignment_for_client(state, assignment) : nil, nil]
        end
        respond(error ? { :assignment => nil, :error => error } : { :assignment => result })
    end

    post "/api/playtest/feedback" do
        data = playtest_request(:assignment, :answers)
        _, error = @@playtesting.transaction do |state|
            Playtesting.give_feedback(state, data[:assignment], data[:browser], data[:answers])
        end
        respond(error ? { :error => error } : Playtesting.status(@@playtesting.read, data[:browser]))
    end

    def get_graph(tag)
        assert((!tag.include?(".")) && tag.size == 7)
        root_tag = nil
        neo4j_query(<<~END_OF_QUERY, :tag => tag).each { |row| root_tag = row['tag'] }
            MATCH (g:Game {tag: $tag})
            WHERE NOT (g)-[:PARENT]->(:Game)
            RETURN g.tag AS tag;
        END_OF_QUERY
        root_tag ||= neo4j_query_expect_one(<<~END_OF_QUERY, :tag => tag)['tag']
            MATCH (g:Game {tag: $tag})-[:PARENT*]->(o:Game)
            WHERE NOT (o)-[:PARENT]->(:Game)
            RETURN DISTINCT o.tag AS tag;
        END_OF_QUERY
        tags = Set.new()
        tags << root_tag
        neo4j_query(<<~END_OF_QUERY, :root_tag => root_tag).each { |row| tags << row['tag'] }
            MATCH (g:Game)-[:PARENT*0..]->(r:Game {tag: $root_tag})
            RETURN g.tag AS tag;
        END_OF_QUERY
        nodes = {}
        neo4j_query(<<~END_OF_QUERY, :tags => tags.to_a).each do |row|
            MATCH (g:Game) WHERE g.tag IN $tags
            OPTIONAL MATCH (g)-[:PARENT]->(p:Game)
            RETURN g, p.tag AS parent;
        END_OF_QUERY
            nodes[row['g'][:tag]] = {}
            nodes[row['g'][:tag]][:parent] = row['parent']
            row['g'].each_pair do |key, value|
                nodes[row['g'][:tag]][key] = value
            end
        end

        nodes.each_pair do |tag, node|
            node[:children] ||= []
            if node[:parent]
                nodes[node[:parent]][:children] ||= []
                nodes[node[:parent]][:children] << tag
            end
        end

        def compact(nodes)
            loop do
                nodes.each_pair do |tag, node|
                    if node[:parent]
                        parent_tag = node[:parent]
                        if nodes[parent_tag][:children].size == 1
                            if node[:children].size == 1
                                child_tag = node[:children].first
                                tag = node[:tag]
                                nodes[parent_tag][:children] = [node[:children].first]
                                nodes[parent_tag][:skipped_children] ||= 0
                                nodes[parent_tag][:skipped_children] += (node[:skipped_children] || 0)
                                nodes[parent_tag][:skipped_children] += 1
                                nodes[child_tag][:parent] = node[:parent]
                                nodes.delete(tag)
                                next
                            end
                        end
                    end
                end
                break
            end
        end

        compact(nodes)

        ts_min = nil
        ts_max = nil

        nodes.each_pair do |tag, node|
            ts = node[:ts_created]
            if ts
                ts_min ||= ts
                ts_max ||= ts
                ts_min = ts if ts < ts_min
                ts_max = ts if ts > ts_max
            end
        end
        ts_min ||= 0
        ts_max ||= 0

        graph_parents = {}

        dot = StringIO.open do |io|
            io.puts "digraph {"
            io.puts "graph [fontname = Helvetica, fontsize = 10, nodesep = 0.2, ranksep = 0.3, bgcolor = transparent];"
            io.puts "node [fontname = Helvetica, fontsize = 10, shape = rect, margin = 0, style = filled, color = \"#ffffff\"];"
            io.puts "edge [fontname = Helvetica, fontsize = 10, arrowsize = 0.6, color = \"#808080\", fontcolor = \"#ffffff\"];"
            io.puts 'rankdir=LR;'
            io.puts 'splines=true;'
            nodes.each_pair do |tag, node|
                t = 1.0
                if (ts_max - ts_min).abs > 0.1
                    t = (node[:ts_created] - ts_min).to_f / (ts_max - ts_min)
                end
                opacity = t * 0.25 + 0.5
                color = '#ffffff'
                label = [node[:author] || '', node[:title] || ''].reject { |x| x.strip.empty? }.join(" / ").strip
                io.puts "\"g#{tag}\" [id = \"g#{tag}\", fillcolor = \"#{color}#{sprintf('%02x', (opacity * 255).to_i)}\", shape = circle, fixedsize = true, label = \"\", width = #{t * 0.1 + 0.05} pencolor = \"#000000\"];"
            end
            nodes.each_pair do |tag, node|
                if node[:parent]
                    io.puts "\"g#{node[:parent]}\" -> \"g#{tag}\" [id = \"g#{node[:parent]}g#{tag}\", label = \"#{nodes[node[:parent]][:skipped_children]}\"];";
                    graph_parents[tag] = node[:parent]
                end
            end
            io.puts "}"
            io.string
        end

        svg, status = Open3.capture2("dot -Tsvg", :stdin_data => dot)
        return svg, graph_parents
    end

    get '/api/graph/:tag' do
        tag = params[:tag]
        svg, graph_parents = get_graph(tag)
        respond_raw_with_mimetype(svg, 'image/svg+xml')
    end

    post '/api/graph' do
        data = parse_request_data(:required_keys => [:tag])
        svg, graph_parents = get_graph(data[:tag])
        respond(:svg => svg, :graph_parents => graph_parents)
    end

    post "/api/load_game" do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag]
        assert(!tag.include?("."))
        assert(!tag.include?("/"))
        if tag == "test-game"
            test_game = YAML::load(File.read("/static/test-game.yaml"))
            File.open("/gen/games/test-game.json", "w") { |f| f.write test_game.to_json }
        end
        path = "/gen/games/#{tag}.json"
        # the game of a Fehlerbericht: the teacher opens it with /?<code>
        # (errors.rb show) – no saved game, no sheets
        report_game = File.join(CLIENT_ERROR_GAMES_PATH, "#{tag}.json")
        if !File.exist?(path) && tag =~ PlayCopies::TAG && File.exist?(report_game)
            path = report_game
        else
            Main.render_spritesheet_for_tag(tag)
        end
        game = JSON.parse(File.read(path))
        # STDERR.puts File.read("/gen/games/#{tag}.json")
        # STDERR.puts game.to_yaml
        game["sprites"].map! do |sprite|
            sprite["states"].map! do |state|
                state["frames"].map! do |frame|
                    # debug frame.to_json
                    base64 = Base64::strict_encode64(File.read("/gen/png/#{frame["tag"]}.png"))
                    frame["src"] = "data:image/png;base64,#{base64}"
                    frame
                end
                state
            end
            sprite
        end
        respond(:game => game)
    end

    # games_dir: where the game file goes (a play copy or a Fehlerbericht's game
    # elsewhere, see /api/play_copy); sheets_dir: where its sheet info goes (nil:
    # none needed)
    def save_game(game, add_to_database, games_dir: "/gen/games", sheets_dir: "/gen/spritesheets")
        size = 0
        sprite_count = 0
        state_count = 0
        frame_count = 0
        unique_frames = Set.new()
        pictures = {}
        game["sprites"].map! do |sprite|
            sprite_count += 1
            sprite["states"].map! do |state|
                state_count += 1
                state["frames"].map! do |frame|
                    frame_count += 1
                    png = Base64::strict_decode64(frame["src"].sub("data:image/png;base64,", ""))
                    size += png.size
                    frame_sha1 = Digest::SHA1.hexdigest(png).to_i(16).to_s(36)[0, 7]
                    unique_frames << frame_sha1
                    path = "/gen/png/#{frame_sha1}.png"
                    pictures[path] = png
                    unless File.exist?(path)
                        File.open(path, "w") do |f|
                            f.write png
                        end
                    end
                    frame.delete("src")
                    frame["tag"] = frame_sha1
                    frame
                end
                state
            end
            sprite
        end
        unique_frame_count = unique_frames.size
        parent = game["parent"]
        # game.delete('parent')
        game_json = game.to_json
        size += game_json.size
        tag = Digest::SHA1.hexdigest(game_json).to_i(16).to_s(36)[0, 7]
        path = "#{games_dir}/#{tag}.json"
        unless File.exist?(path)
            FileUtils.mkpath(games_dir)
            File.open(path, "w") do |f|
                f.write game_json
            end
        end
        # a picture deleted by moderation in the moment between (moderation.rb
        # counts this game only once its file is there) is written again
        pictures.each_pair { |picture_path, png| File.binwrite(picture_path, png) unless File.exist?(picture_path) }
        Main.render_spritesheet_for_tag(tag, games_dir: games_dir, info_dir: sheets_dir) if sheets_dir
        if add_to_database
            ts = Time.now.to_i
            neo4j_query(<<~END_OF_QUERY, { :tag => tag, :ts => ts, :size => size, :sprite_count => sprite_count, :state_count => state_count, :frame_count => frame_count, :unique_frame_count => unique_frame_count })
                MERGE (g:Game {tag: $tag})
                SET g.ts_created = COALESCE(g.ts_created, $ts)
                SET g.ts_updated = $ts
                SET g.size = $size
                SET g.sprite_count = $sprite_count
                SET g.state_count = $state_count
                SET g.frame_count = $frame_count
                SET g.unique_frame_count = $unique_frame_count;
            END_OF_QUERY
            if (game["properties"] || {})["title"]
                neo4j_query(<<~END_OF_QUERY, { :content => game["properties"]["title"], :tag => tag, :ts => ts })
                    MATCH (g:Game {tag: $tag})
                    MERGE (s:String {content: $content})
                    MERGE (g)-[:TITLE]->(s);
                END_OF_QUERY
            end
            if (game["properties"] || {})["author"]
                neo4j_query(<<~END_OF_QUERY, { :content => game["properties"]["author"], :tag => tag, :ts => ts })
                    MATCH (g:Game {tag: $tag})
                    MERGE (s:String {content: $content})
                    MERGE (g)-[:AUTHOR]->(s);
                END_OF_QUERY
            end
            if parent && parent != tag
                neo4j_query(<<~END_OF_QUERY, { :tag => tag, :parent => parent })
                    MATCH (g:Game {tag: $tag})
                    MATCH (p:Game {tag: $parent})
                    WHERE p.ts_created <= g.ts_created
                    MERGE (g)-[:PARENT]->(p);
                END_OF_QUERY
            end
            # the same in memory: the load dialog sees the new version at once
            properties = game["properties"].is_a?(Hash) ? game["properties"] : {}
            @@game_index.add(:tag => tag, :parent => parent.is_a?(String) ? parent : nil,
                :title => properties["title"].is_a?(String) ? properties["title"] : nil,
                :author => properties["author"].is_a?(String) ? properties["author"] : nil,
                :ts_created => ts, :ts_updated => ts, :size => size, :sprite_count => sprite_count,
                :state_count => state_count, :frame_count => frame_count, :unique_frame_count => unique_frame_count)
        end
        return tag
    end

    post "/api/save_game" do
        data = parse_request_data(:required_keys => [:game], :types => { :game => Hash }, :max_body_length => 1024 * 1024 * 20)
        game_info = { "properties" => data[:game]["properties"], "parent" => data[:game]["parent"] }
        tag = save_game(data[:game], true)
        # a submitted game: this version is the one tested from now on
        begin
            @@playtesting.after_save(tag, game_info)
        rescue => e
            STDERR.puts "Playtesting after save: #{e}"
        end
        respond(:tag => tag, :icon => icon_for_tag(tag))
    end

    # Spielen and Level testen (studio.js) play the studio's game as it is,
    # without saving it: a play copy (play_copies.rb), private below /raw and
    # never a version of anything. for_report: the game of a Fehlerbericht
    # (crash_report.js), kept with the reports instead.
    post "/api/play_copy" do
        data = parse_request_data(:required_keys => [:game], :optional_keys => [:for_report],
                                  :types => { :game => Hash, :for_report => Object }, :max_body_length => 1024 * 1024 * 20)
        if data[:for_report] == true
            tag = save_game(data[:game], false, games_dir: CLIENT_ERROR_GAMES_PATH, sheets_dir: nil)
        else
            tag = save_game(data[:game], false, games_dir: PlayCopies.games_dir(PLAY_COPIES_PATH),
                            sheets_dir: PlayCopies.sheets_dir(PLAY_COPIES_PATH))
            PlayCopies.touch(PLAY_COPIES_PATH, tag)
            if Time.now.to_i - @@play_copies_pruned_at > PlayCopies::PRUNE_EVERY
                @@play_copies_pruned_at = Time.now.to_i
                PlayCopies.prune(PLAY_COPIES_PATH)
            end
        end
        respond(:tag => tag)
    end

    # The game frame loads a play copy (app.js Game.load) and its sheet info.
    get "/api/play_copy/:tag" do
        play_copy_response(PlayCopies.read(PLAY_COPIES_PATH, params[:tag], :game))
    end

    get "/api/play_copy/:tag/sheets" do
        play_copy_response(PlayCopies.read(PLAY_COPIES_PATH, params[:tag], :sheets))
    end

    def play_copy_response(json)
        if json
            respond_raw_with_mimetype(json, "application/json")
        else
            status 404
            respond(:error => "unknown_play_copy")
        end
    end

    post '/api/search_game' do
        data = parse_request_data(:required_keys => [:query], :optional_keys => [:secret], :max_body_length => 256)
        query = data[:query].to_s.strip.downcase
        if @@game_index.ready?
            hidden = hidden_root_tags(data[:secret].to_s)
            nodes = @@game_index.search(query).reject { |node| hidden.include?(node[:root]) }
            respond(:query => query, :nodes => nodes.map { |node| game_list_entry(node) })
            return
        end
        query_parts = query.split(/\s+/)
        strings = neo4j_query('MATCH (s:String) RETURN s.content AS s;').map { |x| x['s'] }
        tags = neo4j_query('MATCH (g:Game) RETURN g.tag AS s;').map { |x| x['s'] }
        STDERR.puts "Got #{strings.size} strings, #{tags.size} tags"
        result_tags = Set.new()
        query_parts.each do |part|
            if part.size <= 7
                tags.each do |tag|
                    if tag[0, part.size] == part
                        result_tags << tag
                    end
                end
            end
            strings.each do |string|
                s = string.downcase
                if s.include?(part)
                    neo4j_query(<<~END_OF_QUERY, {:string => string}).each do |row|
                        MATCH (g:Game)-[:AUTHOR|:TITLE]->(s:String {content: $string})
                        RETURN g.tag AS tag;
                    END_OF_QUERY
                        result_tags << row['tag']
                    end
                end
            end
        end
        root_tags = Set.new()
        neo4j_query(<<~END_OF_QUERY, {:tags => result_tags.to_a}).each do |row|
            MATCH (g:Game)-[:PARENT*0..]->(r:Game)
            WHERE g.tag IN $tags
            AND NOT (r)-[:PARENT]->(:Game)
            RETURN r.tag AS tag;
        END_OF_QUERY
            root_tags << row['tag']
        end
        nodes = get_current_tips_for_root_nodes(root_tags.to_a)
        respond(:query => query, :nodes => nodes)
    end

    HIDDEN_ROOT_TAGS_PATH = "/app/hidden-root-tags.txt"

    # Families hidden from the load dialog (one root tag per line), unless the
    # dialog was opened with ?<magic word> ("# magic word: …" in the file).
    def hidden_root_tags(secret = '')
        return Set.new unless File.exist?(HIDDEN_ROOT_TAGS_PATH)
        lines = File.read(HIDDEN_ROOT_TAGS_PATH).split("\n").map(&:strip)
        magic_word = lines.find { |x| x.start_with?("# magic word:") }.to_s.sub("# magic word:", "").strip
        return Set.new if !magic_word.empty? && secret == magic_word
        lines.reject { |x| x.empty? || x.start_with?("#") }.to_set
    end

    def all_root_tags(secret = '')
        root_tags = neo4j_query(<<~END_OF_QUERY).map { |x| x['tag'] }
            MATCH (r:Game)
            WHERE NOT (r)-[:PARENT]->(:Game)
            RETURN r.tag AS tag;
        END_OF_QUERY
        hidden = hidden_root_tags(secret)
        root_tags.reject! { |tag| hidden.include?(tag) }
        root_tags
    end

    # One game (a version) as the load dialog gets it. The tips of the list
    # also carry the other titles and authors of their family (others), so
    # the dialog's search finds a game by an older name too.
    def game_list_entry(node)
        entry = node.slice(:tag, :parent, :ts_created, :size, :sprite_count, :state_count, :frame_count, :author, :title)
        entry[:icon] = icon_for_tag(node[:tag])
        entry[:relatives_count] = node[:relatives_count] if node[:relatives_count]
        if node[:family_titles]
            others = (node[:family_titles] + node[:family_authors]).uniq - [node[:title], node[:author]]
            entry[:others] = others unless others.empty?
        end
        entry
    end

    def get_current_tips_for_root_nodes(root_tags)
        child_counts_for_root_nodes = {}
        child_tags =$neo4j.neo4j_query(<<~END_OF_QUERY, {:root_tags => root_tags}).each do |row|
            MATCH (g:Game)-[:PARENT*0..]->(r:Game)
            WHERE r.tag in $root_tags
            RETURN r.tag AS root_tag, COUNT(g.tag) AS count;
        END_OF_QUERY
            root_tag = row['root_tag']
            count = row['count']
            child_counts_for_root_nodes[root_tag] = count
        end

        latest_for_root_tag = {}

        neo4j_query(<<~END_OF_QUERY, {:root_tags => root_tags}).each do |row|
            MATCH (r:Game) WHERE r.tag IN $root_tags
            WITH r
            MATCH (g:Game)-[:PARENT*0..]->(r:Game)
            WHERE NOT (:Game)-[:PARENT]->(g)
            RETURN r.tag AS root_tag, g.tag AS tag, g.ts_created AS ts;
        END_OF_QUERY
            # STDERR.puts "> #{row.to_json}"
            root_tag = row['root_tag']
            tag = row['tag']
            ts = row['ts']
            latest_for_root_tag[root_tag] ||= {:tag => tag, :ts => ts}
            if ts > latest_for_root_tag[root_tag][:ts]
                latest_for_root_tag[root_tag] = {:tag => tag, :ts => ts}
            end
        end
        root_tag_for_tag = {}
        latest_for_root_tag.each_pair do |root_tag, tag|
            root_tag_for_tag[tag[:tag]] = root_tag
        end
        nodes = neo4j_query(<<~END_OF_QUERY, {:tags => latest_for_root_tag.values.map { |x| x[:tag] }}).map { |x| x["g"][:author] = x["author"]; x["g"][:title] = x["title"]; x['g'] }
            MATCH (g:Game)
            WHERE g.tag IN $tags
            OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
            OPTIONAL MATCH (g)-[:TITLE]->(t:String)
            WITH g, a.content AS author, t.content AS title
            RETURN g, author, title
            ORDER BY g.ts_created DESC;
        END_OF_QUERY

        nodes.map! do |node|
            node[:icon] = icon_for_tag(node[:tag])
            node[:relatives_count] = child_counts_for_root_nodes[root_tag_for_tag[node[:tag]]]
            node
        end
        nodes.uniq! { |x| x[:tag] }
        nodes
    end

    # The load dialog's list: the newest version of every family. From the
    # index this is a few milliseconds, and the JSON is kept until the next
    # save (the index's version) or a change of the hidden families.
    post "/api/get_games/:secret" do
        secret = params[:secret] || ''
        if @@game_index.ready?
            hidden = hidden_root_tags(secret)
            key = [@@game_index.version, hidden.to_a.sort]
            json = @@game_list_cache_mutex.synchronize do
                if @@game_list_cache.nil? || @@game_list_cache[:key] != key
                    roots = @@game_index.root_tags.reject { |tag| hidden.include?(tag) }
                    nodes = @@game_index.tips(roots).map { |node| game_list_entry(node) }
                    @@game_list_cache = { :key => key, :json => { :nodes => nodes, :indexed => true }.to_json }
                end
                @@game_list_cache[:json]
            end
            respond_raw_with_mimetype(json, "application/json")
            return
        end
        root_tags = all_root_tags(secret)
        nodes = get_current_tips_for_root_nodes(root_tags)
        respond(:nodes => nodes)
    end

    # Spiel laden with a code: does the game exist, and what is it? Only a
    # saved version does: a game file nobody saved (a copy of Spielen from
    # before play_copies.rb) is no game to load.
    post "/api/game_info" do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag].to_s
        assert(tag =~ /\A[a-z0-9]{7}\z/, "bad_tag")
        node = if @@game_index.ready?
            entry = @@game_index.node(tag)
            if entry
                family = @@game_index.family(tag)
                entry[:relatives_count] = family.size
            end
            entry
        else
            neo4j_query(<<~END_OF_QUERY, :tag => tag).map { |row| %w(tag parent title author ts_created).map { |k| [k.to_sym, row[k]] }.to_h }.first
                MATCH (g:Game {tag: $tag})
                OPTIONAL MATCH (g)-[:PARENT]->(p:Game)
                OPTIONAL MATCH (g)-[:TITLE]->(t:String)
                OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
                RETURN g.tag AS tag, p.tag AS parent, t.content AS title, a.content AS author, g.ts_created AS ts_created
                LIMIT 1;
            END_OF_QUERY
        end
        exists = !node.nil? && File.exist?("/gen/games/#{tag}.json")
        node = nil unless exists
        respond(:tag => tag, :exists => exists, :node => node && game_list_entry(node))
    end

    # Every version of the family of a game (oldest first, each with its
    # parent): the dialog draws the family tree from it (game_family.js).
    post "/api/family" do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag].to_s
        assert(tag =~ /\A[a-z0-9]{7}\z/, "bad_tag")
        nodes = if @@game_index.ready?
            @@game_index.family(tag)
        else
            family_from_database(tag)
        end
        respond(:tag => tag, :nodes => nodes.map { |node| game_list_entry(node) })
    end

    # The same as GameIndex#family, asked from Neo4j (before the index is read).
    def family_from_database(tag)
        root_tag = neo4j_query(<<~END_OF_QUERY, :tag => tag).map { |row| row['tag'] }.first
            MATCH (g:Game {tag: $tag})-[:PARENT*0..]->(r:Game)
            WHERE NOT (r)-[:PARENT]->(:Game)
            RETURN r.tag AS tag LIMIT 1;
        END_OF_QUERY
        return [] unless root_tag
        rows = {}
        neo4j_query(<<~END_OF_QUERY, :root_tag => root_tag).each do |row|
            MATCH (g:Game)-[:PARENT*0..]->(:Game {tag: $root_tag})
            OPTIONAL MATCH (g)-[:PARENT]->(p:Game)
            OPTIONAL MATCH (g)-[:TITLE]->(t:String)
            OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
            RETURN DISTINCT g.tag AS tag, p.tag AS parent, t.content AS title, a.content AS author,
                   g.ts_created AS ts_created, g.size AS size, g.sprite_count AS sprite_count,
                   g.state_count AS state_count, g.frame_count AS frame_count;
        END_OF_QUERY
            rows[row['tag']] ||= %w(tag parent title author ts_created size sprite_count state_count frame_count).map { |k| [k.to_sym, row[k]] }.to_h
        end
        index = GameIndex.new.load(rows.values)
        index.family(tag)
    end

    post "/api/get_versions_for_game" do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag]
        assert(!tag.include?("."))
        assert(!tag.include?("/"))
        if @@game_index.ready?
            respond(:nodes => @@game_index.ancestors(tag).map { |node| game_list_entry(node) })
            return
        end
        nodes = neo4j_query(<<~END_OF_QUERY, { :tag => tag }).map { |x| x["g"][:author] = x["author"]; x["g"][:title] = x["title"]; x["g"][:ancestor_count] = x["ac"]; x["g"] }
            MATCH (l:Game {tag: $tag})-[:PARENT*0..]->(g:Game)
            OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
            OPTIONAL MATCH (g)-[:TITLE]->(t:String)
            RETURN g, a.content AS author, t.content AS title
            ORDER BY g.ts_created DESC;
        END_OF_QUERY
        nodes.map! do |node|
            node[:icon] = icon_for_tag(node[:tag])
            node
        end
        nodes.uniq! { |x| x[:tag] }
        respond(:nodes => nodes)
    end

    post '/api/get_all_gifs' do
        tags = []
        Dir['/gen/catalogue/*.gif'].each do |path|
            tags << File.basename(path, '.gif')
        end
        respond(:tags => tags)
    end

    # ------------------------------------------------ Moderation
    # (moderation.rb; ./moderate.rb in the terminal, which also opens the
    # temporary page moderation.html with a secret link)

    # Games deleted in the terminal leave the game list at once: before the
    # lists are answered, new lines of the log are read. While no moderation
    # page is open, the files read for it are forgotten.
    def self.follow_moderation_log
        tags = @@moderation_log_mutex.synchronize do
            found, @@moderation_log_offset = Moderation.deleted_since(MODERATION_PATH, @@moderation_log_offset)
            found
        end
        @@game_index.remove(tags) unless tags.empty?
        @@moderation_catalog_mutex.synchronize do
            @@moderation_catalog = nil if @@moderation_catalog && !Moderation::Session.current(MODERATION_PATH)
        end
    end

    before %r{/api/(get_games|search_game|game_info|family|get_versions_for_game)(/.*)?} do
        Main.follow_moderation_log
    end

    # The page's requests: { "token": …, … } with the token of the open page.
    def moderation_request
        data = (JSON.parse(request.body.read(64 * 1024).to_s) rescue nil)
        data = {} unless data.is_a?(Hash)
        unless Moderation::Session.valid?(MODERATION_PATH, data["token"])
            respond(:error => "closed")
            halt 403
        end
        headers "Cache-Control" => "no-store"
        data
    end

    # All game files, read once in the background (they never change; later
    # ones are added on every request). nil while being read.
    def moderation_catalog
        state = @@moderation_catalog_mutex.synchronize do
            unless @@moderation_catalog
                catalog = Moderation::Catalog.new("/gen", cache: Moderation.cache_path(MODERATION_PATH))
                fresh = { :catalog => catalog, :ready => false }
                @@moderation_catalog = fresh
                Thread.new do
                    begin
                        # pictures and texts of the recipes are never shown or deleted
                        catalog.safe = Moderation.recipe_safe("/static")
                        catalog.refresh
                        fresh[:ready] = true
                    rescue => e
                        debug_error "Moderation: could not read the games: #{e}"
                        @@moderation_catalog_mutex.synchronize { @@moderation_catalog = nil if @@moderation_catalog.equal?(fresh) }
                    end
                end
            end
            @@moderation_catalog
        end
        return nil unless state[:ready]
        state[:catalog].refresh
    end

    def moderation_loading
        progress = @@moderation_catalog_mutex.synchronize { @@moderation_catalog && @@moderation_catalog[:catalog].progress }
        { :loading => progress || [0, 0] }
    end

    # tag → saved (in the database), as far as the index knows yet
    def moderation_saved
        @@game_index.ready? ? ->(tag) { !@@game_index.node(tag).nil? } : nil
    end

    get "/moderation/:token" do
        headers "Cache-Control" => "no-store", "X-Robots-Tag" => "noindex, nofollow", "Referrer-Policy" => "no-referrer"
        content_type "text/html; charset=utf-8"
        unless Moderation::Session.valid?(MODERATION_PATH, params[:token])
            status 404
            return "<!DOCTYPE html><html lang='de'><meta charset='utf-8'><title>Moderation</title>" \
                   "<p style='font-family: sans-serif; margin: 3em'>Diese Moderationsseite ist nicht (mehr) offen. " \
                   "Im Terminal öffnet <code>./moderate.rb web</code> eine neue.</p></html>"
        end
        File.read(File.join(__dir__, "moderation.html"))
    end

    post "/api/moderation/status" do
        session = Moderation::Session.current(MODERATION_PATH)
        moderation_request
        catalog = moderation_catalog
        respond({ :expires_at => session["expires_at"], :now => Time.now.to_i, :playtest => @@playtesting.enabled? }
            .merge(catalog ? { :games => catalog.size } : moderation_loading))
    end

    # Playtesting for the class (playtesting.rb class_view): the games in the
    # round with their teams, every child of the class (who has submitted,
    # how far they are), the live sessions, and every survey sent
    # The teacher's switches (playtesting.rb control): { action: "on" | "off" |
    # "start" | "stop" | "minutes", minutes } – answers the view as it is now
    post "/api/moderation/playtest_control" do
        data = moderation_request
        error = @@playtesting.transaction { |state| Playtesting.control(state, data["action"].to_s, data["minutes"]) }
        return respond(:error => error) if error
        debug "Moderation: Playtesting #{data['action']}#{data['minutes'] ? " #{data['minutes']}" : ''}"
        sessions = COLLABORATION_ENABLED ? @@collaboration_store.summaries : []
        seen = @@playtest_seen_mutex.synchronize { @@playtest_seen.transform_values(&:dup) }
        respond(Playtesting.class_view(@@playtesting.read, sessions: sessions, seen: seen).merge(:now => Time.now.utc.iso8601))
    end

    post "/api/moderation/playtest" do
        moderation_request
        sessions = COLLABORATION_ENABLED ? @@collaboration_store.summaries : []
        seen = @@playtest_seen_mutex.synchronize { @@playtest_seen.transform_values(&:dup) }
        state = @@playtesting.read
        # a round switched on before there were class codes gets its code now
        if state["enabled"] && !state["code"]
            @@playtesting.transaction { |s| Playtesting.ensure_code(s) }
            state = @@playtesting.read
        end
        view = Playtesting.class_view(state, sessions: sessions, seen: seen)
        respond(view.merge(:now => Time.now.utc.iso8601))
    end

    post "/api/moderation/games" do
        data = moderation_request
        catalog = moderation_catalog
        return respond(moderation_loading) unless catalog
        respond(Moderation.page_games(catalog, offset: data["offset"].to_i, limit: data["limit"].to_i,
                                      only_new: data["only_new"] == true, only_saved: data["only_saved"] == true,
                                      saved: moderation_saved))
    end

    # Neues laufend: { since: seconds | null } (moderation.rb page_stream)
    post "/api/moderation/stream" do
        data = moderation_request
        catalog = moderation_catalog
        return respond(moderation_loading) unless catalog
        since = data["since"].is_a?(Integer) ? data["since"] : nil
        respond(Moderation.page_stream(catalog, since: since, limit: data["limit"].to_i, saved: moderation_saved))
    end

    # Fehler: today's open groups of the Fehlerberichte, the latest first, each
    # with the text of `./errors.rb show` (client_errors.rb dashboard) –
    # beside the live stream, a workshop at a glance
    post "/api/moderation/errors" do
        moderation_request
        respond(:groups => ClientErrors.dashboard(CLIENT_ERRORS_PATH), :now => Time.now.to_i)
    end

    # Erledigt: { id: "3f2a1c" } – like ./errors.rb resolve; only a group that
    # is open now. Answers the list as it is afterwards.
    post "/api/moderation/resolve" do
        data = moderation_request
        id = data["id"].to_s
        open_ids = ClientErrors.dashboard(CLIENT_ERRORS_PATH).map { |g| g["id"] }
        return respond(:error => "unknown_group") unless id =~ /\A\h{6}\z/ && open_ids.include?(id)
        ClientErrors.resolve(CLIENT_ERRORS_PATH, id)
        debug "Moderation: Fehlergruppe #{id} erledigt"
        respond(:groups => ClientErrors.dashboard(CLIENT_ERRORS_PATH), :now => Time.now.to_i)
    end

    post "/api/moderation/search" do
        data = moderation_request
        catalog = moderation_catalog
        return respond(moderation_loading) unless catalog
        respond(Moderation.page_search(catalog, data["query"], saved: moderation_saved, only_new: data["only_new"] == true))
    end

    # { tags: [...], later: true|false, reason: "…" }
    post "/api/moderation/delete" do
        data = moderation_request
        catalog = moderation_catalog
        return respond(moderation_loading) unless catalog
        tags = (data["tags"].is_a?(Array) ? data["tags"] : []).map(&:to_s).select { |t| t =~ Moderation::TAG }.uniq.first(1000)
        tags = catalog.with_later_versions(tags) if data["later"] == true
        return respond(:error => "no_games") if tags.empty?
        report = Moderation.delete(tags, catalog: catalog, raw: MODERATION_PATH, database: self, playtesting: @@playtesting,
                                   by: "Moderationsseite", reason: data["reason"].to_s[0, 200])
        @@game_index.remove(report["tags"])
        Main.follow_moderation_log
        debug "Moderation: deleted #{report['tags'].join(' ')}"
        respond(:report => report)
    end

    after "*" do
        cleanup_neo4j()
    end

    get "/play/:tag" do
        redirect "/standalone##{params[:tag]}", 302
    end

    get "/*" do
        path = request.env["REQUEST_PATH"]
        assert(path[0] == "/")
        path = path[1, path.size - 1]
        path = "studio" if path.empty?
        path = path.split("/").first
        if path.include?("..") || (path[0] == "/")
            status 404
            return
        end

        @page_title = ""
        @page_description = ""

        unless path.include?("/")
            unless path.include?(".") || path[0] == "_"
                original_path = path.dup

                path = File::join("/static", path) + ".html"
                if File::exist?(path)
                    content = File::read(path, :encoding => "utf-8")

                    @original_path = original_path

                    template_path = "/static/_template.html"
                    @template ||= {}
                    @template[template_path] ||= File::read(template_path, :encoding => "utf-8")

                    s = @template[template_path].dup
                    s.sub!('#{CONTENT}', content)
                    page_css = ""
                    if File::exist?(path.sub(".html", ".css"))
                        page_css = "<style>\n#{File::read(path.sub(".html", ".css"))}\n</style>"
                    end
                    s.sub!('#{PAGE_CSS_HERE}', page_css)
                    while true
                        index = s.index('#{')
                        break if index.nil?
                        length = 2
                        balance = 1
                        while index + length < s.size && balance > 0
                            c = s[index + length]
                            balance -= 1 if c == "}"
                            balance += 1 if c == "{"
                            length += 1
                        end
                        code = s[index + 2, length - 3]
                        begin
                            #                             STDERR.puts code
                            s[index, length] = eval(code).to_s || ""
                        rescue
                            debug "Error while evaluating for #{(@session_user || {})[:email]}:"
                            debug code
                            raise
                        end
                    end
                    s.gsub!("<!--PAGE_TITLE-->", @page_title)
                    s.gsub!("<!--PAGE_DESCRIPTION-->", @page_description)
                    s
                else
                    status 404
                end
            else
                status 404
            end
        else
            status 404
        end
    end
end
