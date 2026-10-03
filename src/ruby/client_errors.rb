# Fehlerberichte from the studio (src/static/crash_report.js): every error a
# child's browser runs into is appended as one JSON line to
# /raw/client-errors/YYYY-MM-DD.jsonl (/raw is not served by nginx), so the
# teacher can look at them during or after a lesson (show-client-errors.rb)
# and turn them into fixes and regression tests.
#
# Only what helps to reproduce a bug is kept: the message, where it happened,
# the last few clicks and keys, the studio version, which pane and tool, and
# the code of a temporary copy of the game (saved like "Level testen" does,
# never listed anywhere). Strings are cut and unknown keys dropped, so a
# report can never fill the disk or carry arbitrary data.

require "json"
require "fileutils"

module ClientErrors
    MAX_STRING = 2000
    MAX_STACK = 6000
    MAX_BREADCRUMBS = 40
    # per client and minute
    MAX_REPORTS_PER_MINUTE = 20
    TOP_KEYS = %w(kind message source line column stack breadcrumbs context game_tag studio_version count details)
    CONTEXT_KEYS = %w(pane tool level layer_type sprite url user_agent screen in_session sprites levels parent from_recipe)

    def self.cut(value, max = MAX_STRING)
        case value
        when String then value[0, max]
        when Integer, Float, TrueClass, FalseClass, NilClass then value
        else value.to_s[0, max]
        end
    end

    # The report as it is written: known keys only, everything cut to size.
    def self.entry(report, time = Time.now)
        report = {} unless report.is_a?(Hash)
        result = { "time" => time.utc.strftime("%Y-%m-%dT%H:%M:%SZ") }
        TOP_KEYS.each do |key|
            next unless report.include?(key)
            value = report[key]
            case key
            when "stack"
                result[key] = cut(value, MAX_STACK)
            when "breadcrumbs"
                result[key] = (value.is_a?(Array) ? value.last(MAX_BREADCRUMBS) : []).map { |crumb| cut(crumb.is_a?(String) ? crumb : crumb.to_json, 200) }
            when "context", "details"
                hash = value.is_a?(Hash) ? value : {}
                keys = key == "context" ? CONTEXT_KEYS : hash.keys.first(20)
                result[key] = keys.each_with_object({}) do |k, h|
                    h[k.to_s[0, 40]] = cut(hash[k], 500) if hash.include?(k)
                end
            else
                result[key] = cut(value)
            end
        end
        result
    end

    def self.path_for(dir, time = Time.now)
        File.join(dir, "#{time.utc.strftime('%Y-%m-%d')}.jsonl")
    end

    def self.append(dir, entry, time = Time.now)
        FileUtils.mkpath(dir)
        File.open(path_for(dir, time), "a") do |f|
            f.flock(File::LOCK_EX)
            f.puts(entry.to_json)
        end
    end

    # A small sliding window per client, so one broken page in a loop cannot
    # flood the log. Returns true when this report may be written.
    class Limiter
        def initialize(max_per_minute = MAX_REPORTS_PER_MINUTE)
            @max = max_per_minute
            @mutex = Mutex.new
            @counts = {}
        end

        def allow?(client, now = Time.now.to_i)
            @mutex.synchronize do
                @counts.delete_if { |_, (start, _)| now - start >= 60 } if @counts.size > 1000
                start, count = @counts[client]
                if start.nil? || now - start >= 60
                    @counts[client] = [now, 1]
                    true
                elsif count < @max
                    @counts[client] = [start, count + 1]
                    true
                else
                    false
                end
            end
        end
    end
end
