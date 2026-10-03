#!/usr/bin/env ruby
# Playtesting in the classroom, run by the teacher in the terminal (the rules
# and the state: playtesting.rb; the children's side: src/static/playtesting.js).
# Run it in the Ruby container, where /raw is:
#
#   ./config.rb exec ruby ruby playtest.rb              how the round stands
#   ./config.rb exec ruby ruby playtest.rb on [3]       switch on (a test runs 3 minutes)
#   ./config.rb exec ruby ruby playtest.rb off          switch off (surveys being filled in still arrive)
#   ./config.rb exec ruby ruby playtest.rb minutes 4    how long a test runs
#   ./config.rb exec ruby ruby playtest.rb games        the submitted games with their tests
#   ./config.rb exec ruby ruby playtest.rb testers      who has tested how many games
#   ./config.rb exec ruby ruby playtest.rb remove 3fa2  take a game out of the round
#   ./config.rb exec ruby ruby playtest.rb pdf          the Rückmeldungen as a PDF to print
#   ./config.rb exec ruby ruby playtest.rb reset        a new round (the old one is kept in archive/)
#
# The studio notices on/off within half a minute (its ping). The PDF is
# written to /raw/playtesting, which is data/raw/playtesting on the server;
# `pdf archive/<datei>.json` prints an earlier round.

require_relative "playtesting"

# the container may have no locale: names and comments are UTF-8
Encoding.default_external = Encoding::UTF_8

DIR = ENV["PLAYTESTING_PATH"] || "/raw/playtesting"
STORE = Playtesting::Store.new(DIR)

def find_submission(state, id)
    abort "Bitte die Kennung eines Spiels angeben (aus »playtest.rb games«)." if id.to_s.empty?
    found = state["submissions"].values.select { |s| s["id"].start_with?(id) || s["tag"] == id }
    abort "Kein Spiel #{id}." if found.empty?
    abort "#{id} passt auf mehrere Spiele, bitte genauer." if found.size > 1
    found.first
end

def minutes_arg(value)
    minutes = value.to_i
    abort "Bitte eine Zahl von Minuten angeben (1 bis 60)." unless minutes.between?(1, 60)
    minutes
end

def status
    state = STORE.read
    now = Time.now
    games = state["submissions"].values.reject { |s| s["withdrawn"] }
    finished = state["assignments"].values.count { |a| a["finished_at"] }
    running = state["assignments"].values.count { |a| Playtesting.running?(a, state["minutes"].to_i, now) }
    testers = state["assignments"].values.map { |a| a["browser"] }.uniq.size
    puts "Playtesting ist #{state['enabled'] ? 'AN' : 'aus'} – ein Test dauert #{state['minutes']} Minuten."
    puts "Runde seit #{Time.parse(state['round']).localtime.strftime('%d.%m.%Y %H:%M')}: #{games.size} Spiele, #{finished} Tests fertig, #{running} laufen gerade, #{testers} Tester:innen."
end

command = ARGV[0] || "status"
case command
when "status"
    status
when "on"
    minutes = ARGV[1] && minutes_arg(ARGV[1])
    STORE.transaction { |state| state["enabled"] = true; state["minutes"] = minutes if minutes }
    status
when "off"
    STORE.transaction { |state| state["enabled"] = false }
    status
when "minutes"
    minutes = minutes_arg(ARGV[1])
    STORE.transaction { |state| state["minutes"] = minutes }
    status
when "games"
    state = STORE.read
    games = state["submissions"].values.sort_by { |s| s["submitted_at"].to_s }
    puts "Noch kein Spiel eingereicht." if games.empty?
    games.each do |s|
        feedback = Playtesting.feedback_of(state, s["id"])
        broken = feedback.count { |a| a["answers"]["broken"] }
        fun = Playtesting.fun_average(state, s["id"])
        line = "#{s['id']}  #{feedback.size.to_s.rjust(2)} Tests  Spaß #{fun ? format('%.1f', fun).tr('.', ',') : ' – '}  »#{s['title']}« von #{s['author']}  (#{s['tag']}, #{s['tags'].size} #{s['tags'].size == 1 ? 'Version' : 'Versionen'})"
        line += "  #{broken}× nicht spielbar" if broken > 0
        line += "  HERAUSGENOMMEN" if s["withdrawn"]
        puts line
    end
when "testers"
    state = STORE.read
    counts = Hash.new { |h, k| h[k] = [0, 0] }
    state["assignments"].values.each do |a|
        counts[a["name"].to_s][a["finished_at"] ? 0 : 1] += 1
    end
    puts "Noch niemand hat getestet." if counts.empty?
    counts.sort_by { |name, (done, _)| [-done, name.downcase] }.each do |name, (done, open)|
        puts "#{name.empty? ? '(ohne Namen)' : name}: #{done} fertig#{open > 0 ? ", #{open} offen" : ''}"
    end
when "remove"
    STORE.transaction do |state|
        s = find_submission(state, ARGV[1])
        s["withdrawn"] = true
        puts "»#{s['title']}« wird nicht mehr zum Testen verteilt (die Rückmeldungen bleiben)."
    end
when "pdf"
    begin
        require_relative "playtest_pdf"
    rescue LoadError => e
        abort "Prawn fehlt (#{e.message}). Den Ruby-Container neu bauen: ./config.rb build ruby"
    end
    source = ARGV[1..].find { |a| a.end_with?(".json") }
    state = source ? JSON.parse(File.read(File.expand_path(source, DIR))) : STORE.read
    stamp = Time.now.strftime("%Y-%m-%d-%H%M")
    path = ARGV[1..].find { |a| a.end_with?(".pdf") } || File.join(DIR, "rueckmeldungen-#{stamp}.pdf")
    path = File.expand_path(path, DIR)
    PlaytestPDF.render(state, path, static: ENV["STATIC_PATH"] || "/static", gen: ENV["GEN_PATH"] || "/gen",
                       games: File.join(ENV["GEN_PATH"] || "/gen", "games"))
    puts "Geschrieben: #{path}"
    puts "(auf dem Server: data/raw/playtesting/#{File.basename(path)})" if path.start_with?("/raw/playtesting/")
when "reset"
    STORE.reset
    puts "Eine neue Runde beginnt. Die alte liegt in #{File.join(DIR, 'archive')} (drucken: playtest.rb pdf archive/<datei>.json)."
    status
else
    puts File.read(__FILE__, encoding: "UTF-8").lines.drop(1).take_while { |l| l.start_with?("#") }.map { |l| l.sub(/^# ?/, "") }.join
    exit 1
end
