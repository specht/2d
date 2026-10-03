# Fehlerberichte from the studio (src/static/crash_report.js): every error a
# child's browser runs into is appended as one JSON line to
# /raw/client-errors/YYYY-MM-DD.jsonl (/raw is not served by nginx), so the
# teacher can look at them during or after a lesson (errors.rb)
# and turn them into fixes and regression tests.
#
# Only what helps to reproduce a bug is kept: the message, where it happened,
# the last few clicks and keys, the studio version, which pane and tool, and
# the code of a temporary copy of the game (saved like "Level testen" does,
# never listed anywhere). Strings are cut and unknown keys dropped, so a
# report can never fill the disk or carry arbitrary data.

require "json"
require "fileutils"
require "digest"
require "date"

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

    # ------------------------------------------------ reading them back
    # (errors.rb, the terminal helper on the server)

    # The same bug: the same kind, message and place in the code. The
    # address and version of the script do not count (?abc… changes with
    # every update).
    def self.group_key(report)
        source = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
        [report["kind"] || "error", report["message"].to_s[0, 160], source, report["line"]].join("|")
    end

    # A short, stable name for a group, to type on the command line.
    def self.group_id(key)
        Digest::SHA1.hexdigest(key)[0, 6]
    end

    # Every report of the given files, oldest first. Broken lines are skipped.
    def self.read(files)
        files.flat_map do |path|
            File.foreach(path).map { |line| JSON.parse(line) rescue nil }.compact
        end.sort_by { |report| report["time"].to_s }
    end

    # Groups, the most frequent first: { id, key, reports, first, last, resolved, again }.
    # resolved: { id => time } – a group marked as fixed is left out unless
    # it happened again afterwards (then again: true).
    def self.groups(reports, resolved = {})
        by_key = reports.group_by { |report| group_key(report) }
        by_key.map do |key, list|
            id = group_id(key)
            fixed_at = resolved[id]
            again = fixed_at && list.any? { |report| report["time"].to_s > fixed_at }
            next nil if fixed_at && !again
            { "id" => id, "key" => key, "reports" => list, "first" => list.first["time"], "last" => list.last["time"],
              "resolved" => fixed_at, "again" => !!again }
        end.compact.sort_by { |group| [-group["reports"].size, group["last"].to_s] }
    end

    def self.read_resolved(dir)
        JSON.parse(File.read(File.join(dir, "resolved.json")))
    rescue
        {}
    end

    def self.write_resolved(dir, resolved)
        FileUtils.mkpath(dir)
        File.write(File.join(dir, "resolved.json"), JSON.pretty_generate(resolved))
    end

    # The day files (YYYY-MM-DD.jsonl) of the last `days` days, or all.
    def self.files(dir, days = nil, today = Time.now.utc.to_date)
        all = Dir[File.join(dir, "*.jsonl")].sort
        return all if days.nil?
        first = (today - (days - 1)).strftime("%Y-%m-%d")
        all.select { |path| File.basename(path, ".jsonl") >= first }
    end

    # Day files older than `days` days: to delete.
    def self.old_files(dir, days, today = Time.now.utc.to_date)
        keep_from = (today - days).strftime("%Y-%m-%d")
        Dir[File.join(dir, "*.jsonl")].sort.select { |path| File.basename(path, ".jsonl") < keep_from }
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
