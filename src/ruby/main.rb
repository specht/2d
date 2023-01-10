require "base64"
require "chunky_png"
require "date"
require "digest"
require "json"
require "neo4j_bolt"
require "sinatra/base"
require "sinatra/cookies"

require "./credentials.template.rb"
warn_level = $VERBOSE
$VERBOSE = nil
require "./credentials.rb"
$VERBOSE = warn_level
DASHBOARD_SERVICE = ENV["DASHBOARD_SERVICE"]

Neo4jBolt.bolt_host = 'neo4j'
Neo4jBolt.bolt_port = 7687

# ANIMALS = %w(🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐒 🐧 🐦 🦆 🦅 🦉 🦇 🐴 🦄 🐝 🦋 🐌 🐞 🪲 🦗 🐢 🐍 🦎 🐙 🦀 🐠 🐬 🐋 🐊 🐅 🦓 🐘 🐪 🦒 🦘 🐄 🐖 🐑 🐐 🐕 🐈‍⬛ 🐓 🦚 🦜 🦢 🦩 🐇 🐁 🦔)
ANIMALS = %w(s1cfi07 rqaux7w q6xbd0g pxly0tu on87yoe n0vdqui lm78e76 lclapq1 l3lawv5 l2ozijf l2d1t8l l0v66o3 kp11rle k2ram59 jzp6ovu
             jq70giy irath30 hj6vqa0 gdbl86r ga56q6n g54ebrx g8ceaya ffg1kv8 f4jizb6 e2z9poi aob22o8 ako2wyi a7oqxgh a2r8to1 114g99w
             49v6ivw 9g4gu5z 7zl61mu 7hmau5i 6iwskal 4r9nct2 4nyev3o 4j8mqjo)

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
                break unless ENV['SERVICE'] == 'ruby'
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

class Main < Sinatra::Base
    include Neo4jBolt
    helpers Sinatra::Cookies

    configure do
        set :show_exceptions, false
    end

    def self.collect_data
        $neo4j.wait_for_neo4j
    end

    configure do
        @@cache_buster = RandomTag.generate()
        self.collect_data() unless defined?(SKIP_COLLECT_DATA) && SKIP_COLLECT_DATA
        if ENV["SERVICE"] == "ruby" && (File.basename($0) == "thin" || File.basename($0) == "pry.rb")
            setup = SetupDatabase.new()
            setup.setup(self)
        end
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

    post "/api/ping" do
        respond(:pong => "yay")
    end

    def self.render_spritesheet_for_tag(tag)
        path = "/gen/spritesheets/#{tag}.json"
        return if File.exists?(path)
        debug "Rendering spritesheet for #{tag}!"
        FileUtils.mkpath(File.dirname(path))
        game = JSON.parse(File.read("/gen/games/#{tag}.json"))
        sprite_sizes = {}
        sprite_paths = {}
        game['sprites'].each.with_index do |sprite, si|
            sprite['states'].each.with_index do |state, sti|
                state['frames'].each.with_index do |frame, fi|
                    png_path = "/gen/png/#{frame['tag']}.png"
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
        x = 0
        y = 0
        ny = nil
        sheet = nil
        r = 0
        frames_by_height.each do |key|
            r += 1
            break if r > 10
            debug "#{x} #{y} #{sprite_sizes[key]}"
            ny ||= y + sprite_sizes[key][1]
            if ny > MAX_SPRITESHEET_HEIGHT
                debug "next spritesheet!"
                x = 0
                y = 0
                ny = nil
                sheet = nil
                redo
            end
            nx = x + sprite_sizes[key][0]
            if nx > MAX_SPRITESHEET_WIDTH
                debug "next row!"
                x = 0
                y = ny
                ny = nil
                redo
            end
            r = 0
            if sheet.nil?
                sheet = ChunkyPNG::Image.new(MAX_SPRITESHEET_WIDTH, MAX_SPRITESHEET_HEIGHT, ChunkyPNG::Color::TRANSPARENT)
                sheets << sheet
            end

            frame = ChunkyPNG::Image.from_file(sprite_paths[key])
            debug "#{sheets.size - 1} #{x}:#{y} #{frame.width}x#{frame.height} <= #{key}"
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
            sprite_positions[key] = [sheets.size - 1, x + 1, y + 1]
            x = nx
        end
        info = {
            :spritesheets => []
        }
        sheets.each.with_index do |sheet, i|
            path = "/gen/spritesheets/#{tag}-#{i}.png"
            sheet.save(path, :fast_rgba)
            info[:spritesheets] << "#{tag}-#{i}.png"
        end
        tiles = []
        game['sprites'].each.with_index do |sprite, si|
            tiles << []
            sprite['states'].each.with_index do |state, sti|
                tiles.last << []
                state['frames'].each.with_index do |frame, fi|
                    key = "#{si}/#{sti}/#{fi}"
                    tiles.last.last << sprite_positions[key]
                end
            end
        end
        info[:tiles] = tiles
        info[:width] = MAX_SPRITESHEET_WIDTH
        info[:height] = MAX_SPRITESHEET_HEIGHT
        File.open("/gen/spritesheets/#{tag}.json", 'w') do |f|
            f.write(info.to_json)
        end
    end

    def icon_for_tag(tag)
        ANIMALS[tag.to_i(36) % ANIMALS.size]
    end

    post "/api/load_game" do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag]
        Main.render_spritesheet_for_tag(tag)
        assert(!tag.include?('.'))
        assert(!tag.include?('/'))
        if tag == 'test-game'
            test_game = YAML::load(File.read('/static/test-game.yaml'))
            File.open('/gen/games/test-game.json', 'w') { |f| f.write test_game.to_json }
        end
        game = JSON.parse(File.read("/gen/games/#{tag}.json"))
        # STDERR.puts File.read("/gen/games/#{tag}.json")
        # STDERR.puts game.to_yaml
        game['sprites'].map! do |sprite|
            sprite['states'].map! do |state|
                state['frames'].map! do |frame|
                    # debug frame.to_json
                    base64 = Base64::strict_encode64(File.read("/gen/png/#{frame['tag']}.png"))
                    frame['src'] = "data:image/png;base64,#{base64}"
                    frame
                end
                state
            end
            sprite
        end
        respond(:game => game)
    end

    def save_game(game, add_to_database)
        size = 0
        sprite_count = 0
        state_count = 0
        frame_count = 0
        unique_frames = Set.new()
        game['sprites'].map! do |sprite|
            sprite_count += 1
            sprite['states'].map! do |state|
                state_count += 1
                state['frames'].map! do |frame|
                    frame_count += 1
                    png = Base64::strict_decode64(frame['src'].sub('data:image/png;base64,', ''))
                    size += png.size
                    frame_sha1 = Digest::SHA1.hexdigest(png).to_i(16).to_s(36)[0, 7]
                    unique_frames << frame_sha1
                    path = "/gen/png/#{frame_sha1}.png"
                    unless File.exists?(path)
                        File.open(path, 'w') do |f|
                            f.write png
                        end
                    end
                    frame.delete('src')
                    frame['tag'] = frame_sha1
                    frame
                end
                state
            end
            sprite
        end
        unique_frame_count = unique_frames.size
        parent = game['parent']
        # game.delete('parent')
        game_json = game.to_json
        size += game_json.size
        tag = Digest::SHA1.hexdigest(game_json).to_i(16).to_s(36)[0, 7]
        path = "/gen/games/#{tag}.json"
        unless File.exists?(path)
            File.open(path, 'w') do |f|
                f.write game_json
            end
        end
        Main.render_spritesheet_for_tag(tag)
        if add_to_database
            neo4j_query(<<~END_OF_QUERY, {:tag => tag, :ts => Time.now.to_i, :size => size, :sprite_count => sprite_count, :state_count => state_count, :frame_count => frame_count, :unique_frame_count => unique_frame_count})
                MERGE (g:Game {tag: $tag})
                SET g.ts_created = COALESCE(g.ts_created, $ts)
                SET g.ts_updated = $ts
                SET g.size = $size
                SET g.sprite_count = $sprite_count
                SET g.state_count = $state_count
                SET g.frame_count = $frame_count
                SET g.unique_frame_count = $unique_frame_count;
            END_OF_QUERY
            if (game['properties'] || {})['title']
                neo4j_query(<<~END_OF_QUERY, {:content => game['properties']['title'], :tag => tag, :ts => Time.now.to_i})
                    MATCH (g:Game {tag: $tag})
                    MERGE (s:String {content: $content})
                    CREATE (g)-[:TITLE]->(s);
                END_OF_QUERY
            end
            if (game['properties'] || {})['author']
                neo4j_query(<<~END_OF_QUERY, {:content => game['properties']['author'], :tag => tag, :ts => Time.now.to_i})
                    MATCH (g:Game {tag: $tag})
                    MERGE (s:String {content: $content})
                    CREATE (g)-[:AUTHOR]->(s);
                END_OF_QUERY
            end
            if parent && parent != tag
                neo4j_query(<<~END_OF_QUERY, {:tag => tag, :parent => parent})
                    MATCH (g:Game {tag: $tag})
                    MATCH (p:Game {tag: $parent})
                    WHERE p.ts_created < g.ts_created
                    CREATE (g)-[:PARENT]->(p);
                END_OF_QUERY
            end
        end
        return tag
    end

    post "/api/save_game" do
        data = parse_request_data(:required_keys => [:game], :types => {:game => Hash}, :max_body_length => 1024 * 1024 * 20)
        tag = save_game(data[:game], true)
        respond(:tag => tag, :icon => icon_for_tag(tag))
    end

    post "/api/save_game_temp" do
        data = parse_request_data(:required_keys => [:game], :types => {:game => Hash}, :max_body_length => 1024 * 1024 * 20)
        tag = save_game(data[:game], false)
        respond(:tag => tag, :icon => icon_for_tag(tag))
    end

    post '/api/get_games' do
        nodes = neo4j_query(<<~END_OF_QUERY).map { |x| x['g'][:author] = x['author']; x['g'][:title] = x['title']; x['g'][:ancestor_count] = x['ac']; x['g'] }
            MATCH (g:Game)
            WHERE NOT (:Game)-[:PARENT]->(g)
            OPTIONAL MATCH (g)-[:PARENT*]->(p:Game)
            OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
            OPTIONAL MATCH (g)-[:TITLE]->(t:String)
            RETURN g, a.content AS author, t.content AS title, COUNT(DISTINCT p) AS ac
            ORDER BY g.ts_created DESC;
        END_OF_QUERY
        nodes.map! do |node|
            node[:icon] = icon_for_tag(node[:tag])
            node
        end
        nodes.uniq! { |x| x[:tag] }
        respond(:nodes => nodes)
    end

    post '/api/get_versions_for_game' do
        data = parse_request_data(:required_keys => [:tag])
        tag = data[:tag]
        assert(!tag.include?('.'))
        assert(!tag.include?('/'))
        nodes = neo4j_query(<<~END_OF_QUERY, {:tag => tag}).map { |x| x['g'][:author] = x['author']; x['g'][:title] = x['title']; x['g'][:ancestor_count] = x['ac']; x['g'] }
            MATCH (g:Game {tag: $tag})
            OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
            OPTIONAL MATCH (g)-[:TITLE]->(t:String)
            RETURN g, a.content AS author, t.content AS title;
        END_OF_QUERY
        nodes += neo4j_query(<<~END_OF_QUERY, {:tag => tag}).map { |x| x['g'][:author] = x['author']; x['g'][:title] = x['title']; x['g'][:ancestor_count] = x['ac']; x['g'] }
            MATCH (l:Game {tag: $tag})-[:PARENT*]->(g:Game)
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

    after '*' do
        cleanup_neo4j()
    end

    get '/*' do
        path = request.env['REQUEST_PATH']
        assert(path[0] == '/')
        path = path[1, path.size - 1]
        path = 'studio' if path.empty?
        path = path.split('/').first
        if path.include?('..') || (path[0] == '/')
            status 404
            return
        end

        @page_title = ''
        @page_description = ''

        unless path.include?('/')
            unless path.include?('.') || path[0] == '_'
                original_path = path.dup

                path = File::join('/static', path) + '.html'
                if File::exists?(path)
                    content = File::read(path, :encoding => 'utf-8')

                    @original_path = original_path

                    template_path = "/static/_template.html"
                    @template ||= {}
                    @template[template_path] ||= File::read(template_path, :encoding => 'utf-8')

                    s = @template[template_path].dup
                    s.sub!('#{CONTENT}', content)
                    page_css = ''
                    if File::exist?(path.sub('.html', '.css'))
                        page_css = "<style>\n#{File::read(path.sub('.html', '.css'))}\n</style>"
                    end
                    s.sub!('#{PAGE_CSS_HERE}', page_css)
                    while true
                        index = s.index('#{')
                        break if index.nil?
                        length = 2
                        balance = 1
                        while index + length < s.size && balance > 0
                            c = s[index + length]
                            balance -= 1 if c == '}'
                            balance += 1 if c == '{'
                            length += 1
                        end
                        code = s[index + 2, length - 3]
                        begin
#                             STDERR.puts code
                            s[index, length] = eval(code).to_s || ''
                        rescue
                            debug "Error while evaluating for #{(@session_user || {})[:email]}:"
                            debug code
                            raise
                        end
                    end
                    s.gsub!('<!--PAGE_TITLE-->', @page_title)
                    s.gsub!('<!--PAGE_DESCRIPTION-->', @page_description)
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
