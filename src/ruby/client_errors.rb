# Fehlerberichte from the studio (src/static/crash_report.js): every error a
# child's browser runs into is appended as one JSON line to
# /raw/client-errors/YYYY-MM-DD.jsonl (/raw is not served by nginx), so the
# teacher can look at them during or after a lesson (errors.rb)
# and turn them into fixes and regression tests.
#
# Only what helps to reproduce a bug is kept: the message, where it happened,
# the last few clicks and keys, the studio version, which pane and tool, and
# the code of a copy of the game (in spiele/ beside the day files, see
# game_path; pruned and cleared with the reports, never listed anywhere). Strings are cut and unknown keys dropped, so a
# report can never fill the disk or carry arbitrary data.

require "json"
require "fileutils"
require "digest"
require "date"
require "time"

module ClientErrors
    MAX_STRING = 2000
    MAX_STACK = 6000
    MAX_BREADCRUMBS = 40
    # per client and minute
    MAX_REPORTS_PER_MINUTE = 20
    TOP_KEYS = %w(kind message source line column stack breadcrumbs context game_tag studio_version count details)
    CONTEXT_KEYS = %w(pane tool level layer_type sprite url user_agent screen in_session sprites levels parent from_recipe page)

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

    # The same bug: the same message reached the same way – the first two
    # frames of the studio's own code in the stack, by function and file.
    # Line numbers, the script's version (?abc…) and whether it arrived as an
    # uncaught error or a rejected promise do not count, so one bug stays one
    # group across updates. Without a stack: the file and line, as before.
    def self.group_key(report)
        kind = report["kind"] || "error"
        kind = "error" if kind == "promise"
        frames = app_frames(report["stack"]).first(2)
        where = if frames.any?
            frames.map { |f| "#{f[:function]}@#{f[:file]}" }.join(" < ")
        else
            [script_name(report["source"]), report["line"]].join(":")
        end
        [kind, normalized_message(report["message"]), where].join("|")
    end

    # The key before October 2026 (kind, message, file and line): resolved.json
    # and the codes people noted down still work with it.
    def self.legacy_group_key(report)
        source = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
        [report["kind"] || "error", report["message"].to_s[0, 160], source, report["line"]].join("|")
    end

    # "Uncaught TypeError: Cannot read … (reading 'drop')" from window.onerror
    # and "Cannot read … (reading 'drop')" from a rejected promise are the
    # same; numbers (positions, sizes) do not make another bug.
    def self.normalized_message(message)
        message.to_s.sub(/\AUncaught /, "").sub(/\A(?:[A-Z][A-Za-z]*)?Error: /, "").gsub(/\d+/, "N")[0, 160]
    end

    # "game.js" from "https://2d.hackschule.de/game.js?2dhh7m8y04pc".
    def self.script_name(url)
        url.to_s.sub(/[?#].*\z/, "").split("/").last.to_s
    end

    # The stack's frames in the studio's own scripts, outermost last:
    # [{ function:, file:, line: }]. Reads Chrome ("at f (url:1:2)") and
    # Firefox/Safari ("f@url:1:2"); libraries (*.min.js) and browser
    # extensions are left out.
    def self.app_frames(stack)
        stack.to_s.lines.filter_map do |line|
            line = line.strip
            if (m = line.match(/\Aat (?:async )?(?:(.+?) \()?(\S+?):(\d+):\d+\)?\z/)) ||
               (m = line.match(/\A(.*?)@(\S+?):(\d+):\d+\z/))
                function, url, number = m[1], m[2], m[3].to_i
            else
                next
            end
            next unless url =~ %r{\Ahttps?://}
            file = script_name(url)
            next if file.empty? || file.end_with?(".min.js")
            function = function.to_s.sub(/ \[as [^\]]*\]\z/, "").strip
            { function: function.empty? ? "(anonym)" : function, file: file, line: number }
        end
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
    # A group resolved under an old code (legacy_group_key, before October
    # 2026) counts as resolved then: the old groups it took in are the same
    # bug now. legacy_ids: the old codes of its reports, so `show` finds them.
    # related: the codes of other groups that happened together with this
    # one (related_groups).
    def self.groups(reports, resolved = {})
        by_key = reports.group_by { |report| group_key(report) }
        result = by_key.map do |key, list|
            id = group_id(key)
            legacy_ids = list.map { |report| group_id(legacy_group_key(report)) }.uniq
            fixed_at = resolved[id] || legacy_ids.filter_map { |legacy| resolved[legacy] }.max
            again = fixed_at && list.any? { |report| report["time"].to_s > fixed_at }
            next nil if fixed_at && !again
            { "id" => id, "key" => key, "reports" => list, "first" => list.first["time"], "last" => list.last["time"],
              "resolved" => fixed_at, "again" => !!again, "legacy_ids" => legacy_ids }
        end.compact
        related = related_groups(result)
        result.each { |group| group["related"] = related[group["id"]] || [] }
        result.sort_by { |group| [-group["reports"].size, group["last"].to_s] }
    end

    # One mistake often throws more than once (the 'drop' picker in the
    # middle of Game._load, and the half-loaded studio afterwards): reports
    # from the same page (context.page; older reports: the same browser and
    # window size) less than INCIDENT_SECONDS apart belong to one incident.
    # Returns { id => [ids of the other groups in its incidents] }.
    INCIDENT_SECONDS = 10

    def self.related_groups(groups)
        entries = groups.flat_map { |group| group["reports"].map { |report| [report, group["id"]] } }
        links = Hash.new { |h, k| h[k] = [] }
        entries.group_by do |report, _|
            context = report["context"] || {}
            context["page"] || "#{context['user_agent']}|#{context['screen']}"
        end.each_value do |list|
            incident = []
            last_time = nil
            list.sort_by { |report, _| report["time"].to_s }.each do |report, id|
                time = (Time.iso8601(report["time"].to_s) rescue nil)
                if last_time.nil? || time.nil? || time - last_time > INCIDENT_SECONDS
                    link_incident(incident, links)
                    incident = []
                end
                incident << id
                last_time = time
            end
            link_incident(incident, links)
        end
        links.transform_values(&:uniq)
    end

    def self.link_incident(ids, links)
        ids = ids.uniq
        ids.each { |id| links[id].concat(ids - [id]) } if ids.size > 1
    end

    # Deletes every day file (all reports); resolved.json stays, so a fixed
    # bug that comes back is still marked as such. Returns how many files.
    def self.clear(dir)
        all = files(dir)
        all.each { |path| File.delete(path) }
        game_files(dir).each { |path| File.delete(path) }
        all.size
    end

    # The reports' games (/api/play_copy with for_report): <dir>/spiele/<tag>.json.
    def self.games_dir(dir) = File.join(dir, "spiele")
    def self.game_files(dir) = Dir[File.join(games_dir(dir), "*.json")].sort

    # Where a report's game is: with the reports, or – a report from before –
    # among the game files in gen_dir. nil when it is gone.
    def self.game_path(tag, gen_dir, dir: nil)
        raise ArgumentError, "Kein gültiger Spielcode: #{tag}" unless tag.to_s =~ /\A[a-z0-9]{7}\z/
        [(File.join(games_dir(dir), "#{tag}.json") if dir), File.join(gen_dir, "games", "#{tag}.json")]
            .compact.find { |path| File.exist?(path) }
    end

    # Games older than `days` days: to delete with the old day files.
    def self.old_games(dir, days, now = Time.now)
        limit = now - days * 24 * 3600
        game_files(dir).select { |path| File.mtime(path) < limit }
    end

    # A report's game (game_tag) as one JSON file (for a test): the copy
    # (game_path; dir: the reports' directory) with its frames put back in as
    # data URLs, like /api/load_game does. Without pictures, every frame keeps
    # only its tag – much smaller, and enough for most bugs, which are about
    # the data and not the pixels.
    def self.game_json(tag, gen_dir, pictures: true, dir: nil)
        path = game_path(tag, gen_dir, dir: dir)
        raise ArgumentError, "Das Spiel #{tag} gibt es nicht mehr." unless path
        game = JSON.parse(File.read(path))
        if pictures
            (game["sprites"] || []).each do |sprite|
                (sprite["states"] || []).each do |state|
                    (state["frames"] || []).each do |frame|
                        png = File.binread(File.join(gen_dir, "png", "#{frame['tag']}.png")) rescue nil
                        frame["src"] = "data:image/png;base64,#{[png].pack('m0')}" if png
                    end
                end
            end
        end
        game["parent"] = tag
        JSON.pretty_generate(game)
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
