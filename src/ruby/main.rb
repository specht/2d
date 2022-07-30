require "base64"
require "digest"
require "json"
require "neo4j_ruby_driver"
require "sinatra/base"
require "sinatra/cookies"

require "./credentials.template.rb"
warn_level = $VERBOSE
$VERBOSE = nil
require "./credentials.rb"
$VERBOSE = warn_level
DASHBOARD_SERVICE = ENV["DASHBOARD_SERVICE"]

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

module QtsNeo4j
    class CypherError < StandardError
        def initialize(code, message)
            @code = code
            @message = message
        end

        def to_s
            "Cypher Error\n#{@code}\n#{@message}"
        end
    end

    def transaction(&block)
        @@neo4j_driver ||= Neo4j::Driver::GraphDatabase.driver("bolt://neo4j:7687")
        if @has_bolt_session.nil?
            begin
                @has_bolt_session = true
                @@neo4j_driver.session do |session|
                    if @has_bolt_transaction.nil?
                        begin
                            session.write_transaction do |tx|
                                @has_bolt_transaction = tx
                                yield
                            end
                        ensure
                            @has_bolt_transaction = nil
                        end
                    else
                        yield
                    end
                end
            rescue StandardError => e
                debug("[NEO4J ERROR] #{e}")
            ensure
                @has_bolt_session = nil
            end
        else
            yield
        end
    end

    class ResultRow
        def initialize(v)
            @v = Hash[v.map { |k, v| [k.to_sym, v] }]
        end

        def props
            @v
        end
    end

    def wait_for_neo4j
        delay = 1
        10.times do
            begin
                neo4j_query("MATCH (n) RETURN n LIMIT 1;")
                break
            rescue
                STDERR.puts $!
                STDERR.puts "Retrying after #{delay} seconds..."
                sleep delay
                delay += 1
            end
        end
    end

    def parse_neo4j_result(x)
        if x.is_a?(Neo4j::Driver::Types::Node) || x.is_a?(Neo4j::Driver::Types::Relationship)
            v = x.properties
            Hash[v.map { |k, v| [k.to_sym, v] }]
        elsif x.is_a?(Array)
            x.map { |y| parse_neo4j_result(y) }
        else
            x
        end
    end

    def neo4j_query(query_str, options = {})
        transaction do
            temp_result = nil
            temp_result = @has_bolt_transaction.run(query_str, options)

            result = []
            temp_result.each do |row|
                item = {}
                row.keys.each.with_index do |key, i|
                    v = row.values[i]
                    item[key.to_s] = parse_neo4j_result(v)
                end
                result << item
            end
            result
        end
    end

    def neo4j_query_expect_one(query_str, options = {})
        result = neo4j_query(query_str, options)
        unless result.size == 1
            if DEVELOPMENT
                debug "-" * 40
                debug query_str
                debug options.to_json
                debug "-" * 40
            end
            raise "Expected one result but got #{result.size}"
        end
        result.first
    end
end

class Neo4jGlobal
    include QtsNeo4j
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
    include QtsNeo4j

    def setup(main)
        wait_for_neo4j
        delay = 1
        10.times do
            begin
                neo4j_query("MATCH (n) RETURN n LIMIT 1;")
                break unless ENV['SERVICE'] == 'ruby'
                transaction do
                    debug "Setting up constraints and indexes..."
#                     neo4j_query("CREATE CONSTRAINT ON (n:Book) ASSERT n.stem IS UNIQUE")
#                     neo4j_query("CREATE INDEX ON :Book(isbn)")
                end
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
    include QtsNeo4j
    helpers Sinatra::Cookies

    configure do
        set :show_exceptions, false
    end

    def self.collect_data
        $neo4j.wait_for_neo4j
    end

    configure do
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

    post "/api/load_game" do
        data = parse_request_data(:required_keys => [:tag])
        debug data.to_yaml
        tag = data[:tag]
        assert(!tag.include?('.'))
        assert(!tag.include?('/'))
        if DEVELOPMENT && tag == 'test-game'
            test_game = YAML::load(File.read('/static/test-game.yaml'))
            File.open('/gen/games/test-game.json', 'w') { |f| f.write test_game.to_json }
        end
        game = JSON.parse(File.read("/gen/games/#{tag}.json"))
        game['sprites'].map! do |sprite|
            sprite['states'].map! do |state|
                state['frames'].map! do |frame|
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
