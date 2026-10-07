#!/usr/bin/env ruby
# The studio's Fehlerberichte on the server, in the terminal (the reports
# themselves: client_errors.rb, crash_report.js). Run it in the Ruby
# container, where /raw is (./config.rb exec ruby sh; from outside, put
# "./config.rb exec ruby ruby" in front instead of "./"):
#
#   ./errors.rb                    today, grouped
#   ./errors.rb list 7             the last 7 days (list all: everything)
#   ./errors.rb show 3f2a1c        one group in detail: stack, clicks, games
#   ./errors.rb game 3f2a1c > spiel.json
#                                  the group's game as a file the studio loads
#                                  (--ohne-bilder: frames only by their tag;
#                                  a path instead of > writes there, e.g. /raw/…)
#   ./errors.rb watch              new reports as they come in (Strg+C ends)
#   ./errors.rb resolve 3f2a1c     fixed: hidden until it happens again
#   ./errors.rb prune 30           delete days (and their games) older than 30 days
#   ./errors.rb clear              delete every report (asks; --ja does not)
#
# A report's game is a copy of the child's game at the moment of the error,
# kept with the reports (spiele/, pruned and cleared with them): open the
# studio with /?<code> to look at it and reproduce the bug, then fix it and
# add a regression test.
#
# One group is one bug: the same message reached the same way (the first two
# frames of the studio's code in the stack), whatever the line numbers of the
# version and whether it came as an error or a rejected promise. Codes from
# before (by file and line) still work for show and resolve.
#
# In a terminal the output is coloured; NO_COLOR=1 switches that off,
# FORCE_COLOR=1 keeps it in a pipe (… | less -R).

require_relative "client_errors"
require_relative "terminal_colors"

DIR = ENV["CLIENT_ERRORS_PATH"] || "/raw/client-errors"
GEN = ENV["GEN_PATH"] || "/gen"

include TerminalColors::Helpers

def days_arg(value, default)
    return nil if value == "all"
    value.nil? ? default : [value.to_i, 1].max
end

def find_group(id)
    fail_with "Bitte die Kennung einer Gruppe angeben (aus »./errors.rb list«)." if id.to_s.empty?
    groups = ClientErrors.groups(ClientErrors.read(ClientErrors.files(DIR)), ClientErrors.read_resolved(DIR))
    group = groups.find { |g| g["id"].start_with?(id) } ||
            groups.find { |g| g["legacy_ids"].any? { |legacy| legacy.start_with?(id) } }
    fail_with "Keine Gruppe #{id} (oder sie ist erledigt und nicht wieder aufgetreten)." unless group
    group
end

def one_line(report)
    context = report["context"] || {}
    where = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
    "#{c(report['time'], :dim)}  #{c("#{context['pane']}/#{context['tool']}", :cyan)}  #{c(report['message'].to_s[0, 90], :red)}  #{c("#{where}:#{report['line']}", :dim)}"
end

def ids(list) = list.map { |id| c(id, :magenta) }.join(", ")

command = ARGV[0] || "list"
case command
when "list"
    days = days_arg(ARGV[1], 1)
    files = ClientErrors.files(DIR, days)
    groups = ClientErrors.groups(ClientErrors.read(files), ClientErrors.read_resolved(DIR))
    if groups.empty?
        puts c("Keine offenen Fehlerberichte #{days ? "in den letzten #{days} Tag(en)" : 'überhaupt'}.", :green)
        next_steps((["./errors.rb list 7", "die letzten sieben Tage"] if days == 1),
                   ["./errors.rb watch", "neue Berichte sehen, sobald sie kommen"])
        exit
    end
    groups.each do |g|
        latest = g["reports"].last
        versions = g["reports"].map { |r| r["studio_version"] }.uniq.size
        kinds = g["reports"].map { |r| r["kind"] || "error" }.uniq.join("/")
        flag = g["again"] ? "  #{c('WIEDER AUFGETRETEN', :red, :bold)}" : ""
        flag += "  #{c('von selbst erholt', :green)}" if g["recovered"]
        puts "#{c(g['id'], :yellow, :bold)}  #{c("#{g['reports'].size.to_s.rjust(4)}×", :bold)}  #{c("[#{kinds}]", :cyan)} #{latest['message'].to_s[0, 100]}#{flag}"
        puts c("        zuletzt #{g['last']}, zuerst #{g['first']}, #{versions} Version(en)", :dim)
        puts "        #{c('zusammen mit', :dim)} #{ids(g['related'])}" unless g["related"].empty?
    end
    puts c("#{groups.map { |g| g['reports'].size }.sum} Berichte in #{groups.size} Gruppen.", :dim)
    next_steps(["./errors.rb show #{groups.first['id']}", "Einzelheiten zur häufigsten Gruppe"],
               (["./errors.rb list 7", "die letzten sieben Tage"] if days == 1),
               ["./errors.rb watch", "neue Berichte sehen, sobald sie kommen"])
when "show"
    g = find_group(ARGV[1])
    # the same text as on the moderation page's Fehler column (client_errors.rb)
    ClientErrors.show_lines(g, method(:c)).each { |line| puts line }
    games = g["reports"].map { |r| r["game_tag"] }.compact.uniq
    next_steps((["./errors.rb game #{g['id']} > spiel.json", "das Spiel als Datei, zum Nachstellen"] unless games.empty?),
               (["./errors.rb show #{g['related'].first}", "was im selben Moment passierte"] unless g["related"].empty?),
               ["./errors.rb resolve #{g['id']}", "repariert? Dann ist die Gruppe erledigt"],
               ["./errors.rb list", "alle Gruppen"])
when "game"
    args = ARGV[1..].reject { |a| a == "--ohne-bilder" }
    pictures = !ARGV.include?("--ohne-bilder")
    id, out = args
    fail_with "Bitte eine Kennung (aus »./errors.rb list«) oder einen Spielcode angeben." if id.to_s.empty?
    g = nil
    tag = id if id =~ /\A[a-z0-9]{7}\z/ && ClientErrors.game_path(id, GEN, dir: DIR)
    unless tag
        g = find_group(id)
        tags = g["reports"].map { |r| r["game_tag"] }.compact.uniq
        fail_with "Zu #{g['id']} gibt es kein Spiel (der Fehler kam ohne Kopie, z. B. vor dem Laden eines Spiels)." if tags.empty?
        tag = tags.last
        warn ce("#{g['id']} hat #{tags.size} Spiele, hier das neueste. Die anderen: #{(tags - [tag]).join(' ')}", :dim) if tags.size > 1
    end
    fail_with "Das Spiel #{tag} gibt es nicht mehr (mit alten Berichten gelöscht, oder: ./moderate.rb log)." unless ClientErrors.game_path(tag, GEN, dir: DIR)
    json = ClientErrors.game_json(tag, GEN, pictures: pictures, dir: DIR)
    hint = g ? ["./errors.rb resolve #{g['id']}", "repariert? Dann ist die Gruppe erledigt"] : nil
    if out
        File.write(out, json)
        warn ce("#{tag} → #{out} (#{(json.bytesize / 1024.0).round} KB)", :green)
    else
        puts json
    end
    next_steps(hint, io: $stderr)
when "watch"
    puts c("Neue Fehlerberichte (Strg+C beendet) …", :dim)
    seen = {}
    loop do
        path = ClientErrors.path_for(DIR)
        if File.exist?(path)
            lines = File.readlines(path)
            start = seen[path] || (seen.empty? ? lines.size : 0)
            lines[start..].each do |line|
                report = JSON.parse(line) rescue next
                id = ClientErrors.group_id(ClientErrors.group_key(report))
                puts "#{c(id, :yellow, :bold)}  #{one_line(report)}"
            end
            seen[path] = lines.size
        end
        $stdout.flush
        sleep 2
    end
when "resolve"
    g = find_group(ARGV[1])
    ClientErrors.resolve(DIR, g["id"])
    puts "#{c(g['id'], :yellow, :bold)} #{c('ist erledigt', :green)}: es erscheint erst wieder, wenn es noch einmal passiert."
    next_steps(["./errors.rb list", "was noch offen ist"])
when "prune"
    days = [ARGV[1].to_i, 1].max
    days = 30 if ARGV[1].nil?
    old = ClientErrors.old_files(DIR, days)
    old.each { |path| File.delete(path) }
    games = ClientErrors.old_games(DIR, days)
    games.each { |path| File.delete(path) }
    puts c("#{old.size} Tag(e) und #{games.size} Spiel(e) gelöscht (älter als #{days} Tage).", :green)
    next_steps(["./errors.rb list all", "was noch da ist"])
when "clear"
    files = ClientErrors.files(DIR)
    count = ClientErrors.read(files).size
    if files.empty?
        puts c("Es gibt keine Fehlerberichte.", :green)
        exit
    end
    unless ARGV.include?("--ja")
        print "#{c("Alle #{count} Fehlerberichte (#{files.size} Tag(e)) löschen?", :red, :bold)} Das lässt sich nicht rückgängig machen. Zum Bestätigen #{c('»ja«', :bold)} tippen: "
        $stdout.flush
        answer = $stdin.gets
        fail_with "\nAbgebrochen (ohne Eingabe: ./errors.rb clear --ja)." if answer.nil?
        fail_with "Abgebrochen." unless answer.strip.downcase == "ja"
    end
    ClientErrors.clear(DIR)
    puts "#{c("#{count} Fehlerberichte gelöscht.", :green)} Erledigte Gruppen bleiben vermerkt: kommt so ein Fehler wieder, steht WIEDER AUFGETRETEN dabei."
    next_steps(["./errors.rb watch", "neue Berichte sehen, sobald sie kommen"])
else
    puts File.read(__FILE__, encoding: "UTF-8").lines.drop(1).take_while { |l| l.start_with?("#") }.map { |l| l.sub(/^# ?/, "") }.join
end
