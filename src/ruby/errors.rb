#!/usr/bin/env ruby
# The studio's Fehlerberichte on the server, in the terminal (the reports
# themselves: client_errors.rb, crash_report.js). Run it in the Ruby
# container, where /raw is:
#
#   ./config.rb exec ruby ruby errors.rb                  today, grouped
#   ./config.rb exec ruby ruby errors.rb list 7           the last 7 days (list all: everything)
#   ./config.rb exec ruby ruby errors.rb show 3f2a1c      one group in detail: stack, clicks, games
#   ./config.rb exec ruby ruby errors.rb watch            new reports as they come in (Strg+C ends)
#   ./config.rb exec ruby ruby errors.rb resolve 3f2a1c   fixed: hidden until it happens again
#   ./config.rb exec ruby ruby errors.rb prune 30         delete days older than 30 days
#
# A report's game is a temporary copy of the child's game at the moment of
# the error: open the studio with /?<code> to look at it and reproduce the
# bug, then fix it and add a regression test.

require_relative "client_errors"

DIR = ENV["CLIENT_ERRORS_PATH"] || "/raw/client-errors"

def days_arg(value, default)
    return nil if value == "all"
    value.nil? ? default : [value.to_i, 1].max
end

def find_group(id)
    abort "Bitte die Kennung einer Gruppe angeben (aus »errors.rb list«)." if id.to_s.empty?
    groups = ClientErrors.groups(ClientErrors.read(ClientErrors.files(DIR)))
    group = groups.find { |g| g["id"].start_with?(id) }
    abort "Keine Gruppe #{id} (oder sie ist erledigt und nicht wieder aufgetreten)." unless group
    group
end

def one_line(report)
    context = report["context"] || {}
    where = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
    "#{report['time']}  #{context['pane']}/#{context['tool']}  #{report['message'].to_s[0, 90]}  #{where}:#{report['line']}"
end

command = ARGV[0] || "list"
case command
when "list"
    days = days_arg(ARGV[1], 1)
    files = ClientErrors.files(DIR, days)
    groups = ClientErrors.groups(ClientErrors.read(files), ClientErrors.read_resolved(DIR))
    if groups.empty?
        puts "Keine offenen Fehlerberichte #{days ? "in den letzten #{days} Tag(en)" : 'überhaupt'}."
        exit
    end
    groups.each do |g|
        latest = g["reports"].last
        versions = g["reports"].map { |r| r["studio_version"] }.uniq.size
        flag = g["again"] ? "  WIEDER AUFGETRETEN" : ""
        puts "#{g['id']}  #{g['reports'].size.to_s.rjust(4)}×  [#{latest['kind'] || 'error'}] #{latest['message'].to_s[0, 100]}#{flag}"
        puts "        zuletzt #{g['last']}, zuerst #{g['first']}, #{versions} Version(en)"
    end
    puts "#{groups.map { |g| g['reports'].size }.sum} Berichte in #{groups.size} Gruppen. Einzelheiten: errors.rb show <Kennung>"
when "show"
    g = find_group(ARGV[1])
    latest = g["reports"].last
    context = latest["context"] || {}
    puts "#{g['id']}: #{g['reports'].size}× [#{latest['kind'] || 'error'}] #{latest['message']}"
    puts "Ort:       #{latest['source']}:#{latest['line']}:#{latest['column']}" if latest["source"]
    puts "Zeit:      zuerst #{g['first']}, zuletzt #{g['last']}"
    puts "Versionen: #{g['reports'].map { |r| r['studio_version'] }.uniq.join(', ')}"
    puts "Ansicht:   #{context['pane']} / #{context['tool']}  #{context['url']}  (#{context['screen']})"
    puts "Spiel:     #{context['sprites']} Sprites, #{context['levels']} Level#{context['from_recipe'] ? ", Rezept #{context['from_recipe']}" : ''}#{context['in_session'] ? ', in einer Sitzung' : ''}"
    puts "Browser:   #{context['user_agent']}"
    puts "Details:   #{latest['details'].to_json}" if latest["details"]
    games = g["reports"].map { |r| r["game_tag"] }.compact.uniq
    puts "Spiele zum Nachstellen: #{games.map { |t| "/?#{t}" }.join('  ')}" unless games.empty?
    if latest["stack"]
        puts "", "Stack:"
        latest["stack"].to_s.lines.first(20).each { |l| puts "  #{l.rstrip}" }
    end
    unless (latest["breadcrumbs"] || []).empty?
        puts "", "Davor (die letzten Klicks und Tasten):"
        latest["breadcrumbs"].each { |crumb| puts "  · #{crumb}" }
    end
when "watch"
    puts "Neue Fehlerberichte (Strg+C beendet) …"
    seen = {}
    loop do
        path = ClientErrors.path_for(DIR)
        if File.exist?(path)
            lines = File.readlines(path)
            start = seen[path] || (seen.empty? ? lines.size : 0)
            lines[start..].each do |line|
                report = JSON.parse(line) rescue next
                id = ClientErrors.group_id(ClientErrors.group_key(report))
                puts "#{id}  #{one_line(report)}"
            end
            seen[path] = lines.size
        end
        $stdout.flush
        sleep 2
    end
when "resolve"
    g = find_group(ARGV[1])
    resolved = ClientErrors.read_resolved(DIR)
    resolved[g["id"]] = Time.now.utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    ClientErrors.write_resolved(DIR, resolved)
    puts "#{g['id']} ist erledigt: es erscheint erst wieder, wenn es noch einmal passiert."
when "prune"
    days = [ARGV[1].to_i, 1].max
    days = 30 if ARGV[1].nil?
    old = ClientErrors.old_files(DIR, days)
    old.each { |path| File.delete(path) }
    puts "#{old.size} Tag(e) gelöscht (älter als #{days} Tage)."
else
    puts File.read(__FILE__).lines.drop(1).take_while { |l| l.start_with?("#") }.map { |l| l.sub(/^# ?/, "") }.join
end
