#!/usr/bin/env ruby
# The studio's Fehlerberichte on the server, in the terminal (the reports
# themselves: client_errors.rb, crash_report.js). Run it in the Ruby
# container, where /raw is:
#
#   ./config.rb exec ruby ruby errors.rb                  today, grouped
#   ./config.rb exec ruby ruby errors.rb list 7           the last 7 days (list all: everything)
#   ./config.rb exec ruby ruby errors.rb show 3f2a1c      one group in detail: stack, clicks, games
#   ./config.rb exec ruby ruby errors.rb game 3f2a1c > spiel.json
#                                                         the group's game as a file the studio loads
#                                                         (--ohne-bilder: frames only by their tag;
#                                                         a path instead of > writes there, e.g. /raw/…)
#   ./config.rb exec ruby ruby errors.rb watch            new reports as they come in (Strg+C ends)
#   ./config.rb exec ruby ruby errors.rb resolve 3f2a1c   fixed: hidden until it happens again
#   ./config.rb exec ruby ruby errors.rb prune 30         delete days older than 30 days
#   ./config.rb exec ruby ruby errors.rb clear            delete every report (asks; --ja does not)
#
# A report's game is a temporary copy of the child's game at the moment of
# the error: open the studio with /?<code> to look at it and reproduce the
# bug, then fix it and add a regression test.
#
# One group is one bug: the same message reached the same way (the first two
# frames of the studio's code in the stack), whatever the line numbers of the
# version and whether it came as an error or a rejected promise. Codes from
# before (by file and line) still work for show and resolve.

require_relative "client_errors"

DIR = ENV["CLIENT_ERRORS_PATH"] || "/raw/client-errors"
GEN = ENV["GEN_PATH"] || "/gen"

def days_arg(value, default)
    return nil if value == "all"
    value.nil? ? default : [value.to_i, 1].max
end

def find_group(id)
    abort "Bitte die Kennung einer Gruppe angeben (aus »errors.rb list«)." if id.to_s.empty?
    groups = ClientErrors.groups(ClientErrors.read(ClientErrors.files(DIR)), ClientErrors.read_resolved(DIR))
    group = groups.find { |g| g["id"].start_with?(id) } ||
            groups.find { |g| g["legacy_ids"].any? { |legacy| legacy.start_with?(id) } }
    abort "Keine Gruppe #{id} (oder sie ist erledigt und nicht wieder aufgetreten)." unless group
    group
end

def one_line(report)
    context = report["context"] || {}
    where = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
    "#{report['time']}  #{context['pane']}/#{context['tool']}  #{report['message'].to_s[0, 90]}  #{where}:#{report['line']}"
end

# "game.js:1244 (5×), game.js:1243 (1×)": where the group's first frame was
# (the line moves between versions).
def places(group)
    group["reports"].map do |report|
        frame = ClientErrors.app_frames(report["stack"]).first
        frame ? "#{frame[:file]}:#{frame[:line]}" : "#{ClientErrors.script_name(report['source'])}:#{report['line']}"
    end.tally.sort_by { |_, n| -n }.map { |where, n| "#{where} (#{n}×)" }
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
        kinds = g["reports"].map { |r| r["kind"] || "error" }.uniq.join("/")
        flag = g["again"] ? "  WIEDER AUFGETRETEN" : ""
        puts "#{g['id']}  #{g['reports'].size.to_s.rjust(4)}×  [#{kinds}] #{latest['message'].to_s[0, 100]}#{flag}"
        puts "        zuletzt #{g['last']}, zuerst #{g['first']}, #{versions} Version(en)"
        puts "        zusammen mit #{g['related'].join(', ')}" unless g["related"].empty?
    end
    puts "#{groups.map { |g| g['reports'].size }.sum} Berichte in #{groups.size} Gruppen. Einzelheiten: errors.rb show <Kennung>"
when "show"
    g = find_group(ARGV[1])
    latest = g["reports"].last
    context = latest["context"] || {}
    kinds = g["reports"].map { |r| r["kind"] || "error" }.tally.map { |k, n| "#{k} #{n}×" }.join(", ")
    puts "#{g['id']}: #{g['reports'].size}× (#{kinds}) #{latest['message']}"
    puts "Orte:      #{places(g).join(', ')}"
    puts "Zeit:      zuerst #{g['first']}, zuletzt #{g['last']}"
    puts "Versionen: #{g['reports'].map { |r| r['studio_version'] }.uniq.join(', ')}"
    puts "Zusammen:  mit #{g['related'].join(', ')} (dieselbe Seite, im selben Moment – oft eine Ursache)" unless g["related"].empty?
    puts "Ansicht:   #{context['pane']} / #{context['tool']}  #{context['url']}  (#{context['screen']})"
    puts "Spiel:     #{context['sprites']} Sprites, #{context['levels']} Level#{context['from_recipe'] ? ", Rezept #{context['from_recipe']}" : ''}#{context['in_session'] ? ', in einer Sitzung' : ''}"
    puts "Browser:   #{context['user_agent']}"
    puts "Details:   #{latest['details'].to_json}" if latest["details"]
    games = g["reports"].map { |r| r["game_tag"] }.compact.uniq
    unless games.empty?
        puts "Spiele zum Nachstellen: #{games.map { |t| "/?#{t}" }.join('  ')}"
        puts "           als Datei: errors.rb game #{g['id']} > spiel.json"
    end
    if latest["stack"]
        puts "", "Stack:"
        latest["stack"].to_s.lines.first(20).each { |l| puts "  #{l.rstrip}" }
    end
    unless (latest["breadcrumbs"] || []).empty?
        puts "", "Davor (die letzten Klicks und Tasten):"
        latest["breadcrumbs"].each { |crumb| puts "  · #{crumb}" }
    end
when "game"
    args = ARGV[1..].reject { |a| a == "--ohne-bilder" }
    pictures = !ARGV.include?("--ohne-bilder")
    id, out = args
    abort "Bitte eine Kennung (aus »errors.rb list«) oder einen Spielcode angeben." if id.to_s.empty?
    tag = id if id =~ /\A[a-z0-9]{7}\z/ && File.exist?(File.join(GEN, "games", "#{id}.json"))
    unless tag
        g = find_group(id)
        tags = g["reports"].map { |r| r["game_tag"] }.compact.uniq
        abort "Zu #{g['id']} gibt es kein Spiel (der Fehler kam ohne Kopie, z. B. vor dem Laden eines Spiels)." if tags.empty?
        tag = tags.last
        warn "#{g['id']} hat #{tags.size} Spiele, hier das neueste. Die anderen: #{(tags - [tag]).join(' ')}" if tags.size > 1
    end
    json = ClientErrors.game_json(tag, GEN, pictures: pictures)
    if out
        File.write(out, json)
        warn "#{tag} → #{out} (#{(json.bytesize / 1024.0).round} KB)"
    else
        puts json
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
when "clear"
    files = ClientErrors.files(DIR)
    count = ClientErrors.read(files).size
    if files.empty?
        puts "Es gibt keine Fehlerberichte."
        exit
    end
    unless ARGV.include?("--ja")
        print "Alle #{count} Fehlerberichte (#{files.size} Tag(e)) löschen? Das lässt sich nicht rückgängig machen. Zum Bestätigen »ja« tippen: "
        $stdout.flush
        answer = $stdin.gets
        abort "\nAbgebrochen (ohne Eingabe: errors.rb clear --ja)." if answer.nil?
        abort "Abgebrochen." unless answer.strip.downcase == "ja"
    end
    ClientErrors.clear(DIR)
    puts "#{count} Fehlerberichte gelöscht. Erledigte Gruppen bleiben vermerkt: kommt so ein Fehler wieder, steht WIEDER AUFGETRETEN dabei."
else
    puts File.read(__FILE__).lines.drop(1).take_while { |l| l.start_with?("#") }.map { |l| l.sub(/^# ?/, "") }.join
end
