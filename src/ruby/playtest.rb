#!/usr/bin/env ruby
# Playtesting in the classroom, run by the teacher in the terminal (the rules
# and the state: playtesting.rb; the children's side: src/static/playtesting.js).
# Run it in the Ruby container, where /raw is (./config.rb exec ruby sh; from
# outside, put "./config.rb exec ruby ruby" in front instead of "./"):
#
#   ./playtest.rb               how the round stands: every game's tests, who
#                               is testing what right now, the testers
#   ./playtest.rb watch         the same, kept up to date (Strg+C ends)
#   ./playtest.rb on [3]        switch on (a test runs 3 minutes): the children
#                               see the tab and submit their games
#   ./playtest.rb start         start the testing (only who has a game in the
#                               round gets one to test)
#   ./playtest.rb code [neu]    the class code for the board (neu: a new one;
#                               who has entered the old one stays in)
#   ./playtest.rb stop          end the testing (tests under way are finished)
#   ./playtest.rb off           switch off (surveys being filled in still arrive)
#   ./playtest.rb minutes 4     how long a test runs
#   ./playtest.rb games         the submitted games with their tests
#   ./playtest.rb testers       who has tested how many games
#   ./playtest.rb remove 3fa2   take a game out of the round
#   ./playtest.rb pdf           the Rückmeldungen as a PDF to print
#   ./playtest.rb reset         a new round (the old one is kept in archive/)
#
# The moderation page (./moderate.rb web, Playtesting) has the same switches.
# The studio notices on/off and start/stop within half a minute (its ping);
# an open Playtesting tab looks every few seconds. The PDF is
# written to /raw/playtesting, which is data/raw/playtesting on the server;
# `pdf archive/<datei>.json` prints an earlier round. In a terminal the output
# is coloured; NO_COLOR=1 switches that off.

require_relative "playtesting"
require_relative "terminal_colors"
require "io/console"

# the container may have no locale: names and comments are UTF-8
Encoding.default_external = Encoding::UTF_8

DIR = ENV["PLAYTESTING_PATH"] || "/raw/playtesting"
STORE = Playtesting::Store.new(DIR)
WATCH_SECONDS = 5

include TerminalColors::Helpers

def find_submission(state, id)
    fail_with "Bitte die Kennung eines Spiels angeben (aus »./playtest.rb games«)." if id.to_s.empty?
    found = state["submissions"].values.select { |s| s["id"].start_with?(id) || s["tag"] == id }
    fail_with "Kein Spiel #{id}." if found.empty?
    fail_with "#{id} passt auf mehrere Spiele, bitte genauer." if found.size > 1
    found.first
end

def minutes_arg(value)
    minutes = value.to_i
    fail_with "Bitte eine Zahl von Minuten angeben (1 bis 60)." unless minutes.between?(1, 60)
    minutes
end

def screen_width
    $stdout.winsize[1]
rescue StandardError
    100
end

def clock(seconds) = format("%d:%02d", seconds / 60, seconds % 60)
def number(value) = format("%.1f", value).tr(".", ",")
def game_name(title, author) = "»#{title}« von #{author}"

# Pads a coloured text to a width on screen.
def pad(text, width) = text + " " * [width - TerminalColors.plain(text).size, 0].max

# ████▒▒···: finished tests green, running ones yellow, one cell per test
# (scaled down when a game has more than fit).
def bar(done, running, cells, scale)
    d = (done * scale).round
    r = [(running * scale).round, running > 0 ? 1 : 0].max
    rest = [cells - d - r, 0].max
    c("█" * d, :green) + c("▒" * r, :yellow) + c("·" * rest, :dim)
end

def overview_lines(o)
    lines = []
    active = o["games"].reject { |g| g["withdrawn"] }
    state_word = !o["enabled"] ? c("aus", :red, :bold) :
                 o["testing"] ? c("AN – das Testen läuft", :green, :bold) :
                 o["finished"] > 0 ? c("AN – das Testen ist beendet", :yellow, :bold) : c("AN – die Spiele werden eingereicht", :yellow, :bold)
    round = Time.parse(o["round"]).localtime.strftime("%d.%m.%Y %H:%M") rescue o["round"]
    lines << "#{c('Playtesting', :bold)} ist #{state_word} #{c('·', :dim)} ein Test dauert #{c("#{o['minutes']} Minuten", :bold)} #{c("· Runde seit #{round}", :dim)}"
    lines << "Klassencode: #{c(o['code'], :bold, :yellow)} #{c('(an die Tafel – nur wer ihn eingibt, macht mit)', :dim)}" if o["code"]
    summary = ["#{c(active.size, :bold)} Spiele", "#{c(o['finished'], :bold, :green)} Tests fertig",
               "#{c(o['running'].size, :bold, :yellow)} laufen", "#{c(o['testers'].size, :bold)} Tester:innen"]
    summary << c("#{o['abandoned']} abgebrochen", :dim) if o["abandoned"] > 0
    lines << summary.join(c(" · ", :dim))

    lines << "" << c("Spiele", :bold) + c("  (█ fertig, ▒ läuft gerade)", :dim)
    if o["games"].empty?
        lines << c("  Noch kein Spiel eingereicht.", :dim)
    else
        most = [active.map { |g| g["done"] + g["running"] }.max.to_i, 1].max
        cells = [most, 20].min
        scale = cells.to_f / most
        fewest = active.map { |g| g["done"] }.min
        o["games"].each do |g|
            if g["withdrawn"]
                lines << c("  #{g['id']}  #{'·' * cells}  #{g['done'].to_s.rjust(2)}#{' ' * 15}#{game_name(g['title'], g['author'])}  herausgenommen", :dim)
                next
            end
            counts = "#{c(g['done'].to_s.rjust(2), :bold)}#{g['running'] > 0 ? c(" +#{g['running']}", :yellow) : '   '}"
            fun = g["fun"] ? "Spaß #{number(g['fun'])}" : c("Spaß  – ", :dim)
            name = game_name(g["title"], g["author"])
            name = c(name, :bold) if g["done"] == fewest && active.size > 1
            line = "  #{c(g['id'], :dim)}  #{bar(g['done'], g['running'], cells, scale)}  #{counts}  #{fun}  #{name}"
            line += "  #{c("#{g['broken']}× nicht spielbar", :red, :bold)}" if g["broken"] > 0
            line += "  #{c('niemand mehr frei', :dim)}" if g["left"].zero? && o["testers"].any?
            lines << line
        end
    end

    unless o["running"].empty?
        lines << "" << c("Gerade dabei", :bold)
        width = o["running"].map { |r| (r["name"].empty? ? "(ohne Namen)" : r["name"]).size }.max
        o["running"].each do |r|
            name = (r["name"].empty? ? "(ohne Namen)" : r["name"]).ljust(width)
            what = if r["phase"] == "play"
                "spielt #{game_name(r['title'], r['author'])}  #{c("noch #{clock(r['seconds_left'])}", :yellow)}"
            else
                "füllt die Umfrage aus zu #{game_name(r['title'], r['author'])}  #{c("seit #{clock(r['seconds_over'])}", :dim)}"
            end
            lines << "  #{c(name, :cyan)}  #{what}"
        end
    end

    unless o["testers"].empty?
        lines << "" << c("Tester:innen", :bold) + c("  (Tests fertig, ✓ alle Spiele getestet)", :dim)
        items = o["testers"].map do |t|
            name = t["name"].empty? ? "(ohne Namen)" : t["name"]
            text = "#{c(name, :cyan)} #{c(t['done'], :bold)}"
            text += c("+1", :yellow) if t["running"] > 0
            text += " #{c('✓', :green, :bold)}" if t["left"].zero? && t["running"].zero?
            text
        end
        line = " "
        items.each do |item|
            if TerminalColors.plain(line).size + TerminalColors.plain(item).size + 3 > screen_width
                lines << line
                line = " "
            end
            line += "  #{item}"
        end
        lines << line
    end
    lines
end

def status_hints(o)
    if o["enabled"] && !o["testing"]
        next_steps(["./playtest.rb start", "das Testen starten (wer ein Spiel eingereicht hat, testet)"],
                   ["./playtest.rb watch", "diese Übersicht, laufend aktualisiert"])
    elsif o["enabled"]
        next_steps(["./playtest.rb stop", "das Testen beenden"],
                   ["./playtest.rb watch", "diese Übersicht, laufend aktualisiert"],
                   ["./playtest.rb games", "die Spiele mit ihren Tests"],
                   ["./playtest.rb off", "ausschalten"])
    elsif o["finished"] > 0
        next_steps(["./playtest.rb pdf", "die Rückmeldungen zum Drucken"],
                   ["./playtest.rb on", "wieder einschalten"],
                   ["./playtest.rb reset", "eine neue Runde"])
    else
        next_steps(["./playtest.rb on", "einschalten (ein Test dauert #{o['minutes']} Minuten)"],
                   ["./playtest.rb on 5", "einschalten, ein Test dauert 5 Minuten"])
    end
end

def status
    o = Playtesting.overview(STORE.read)
    puts overview_lines(o)
    status_hints(o)
end

command = ARGV[0] || "status"
case command
when "status"
    status
when "watch"
    trap("INT") { print "\e[?25h" if $stdout.tty?; puts; exit }
    print "\e[?25l" if $stdout.tty?
    loop do
        lines = overview_lines(Playtesting.overview(STORE.read))
        lines << "" << c("Aktualisiert um #{Time.now.strftime('%H:%M:%S')} – alle #{WATCH_SECONDS} Sekunden. Strg+C beendet.", :dim)
        print "\e[H\e[2J" if $stdout.tty?
        puts lines
        $stdout.flush
        sleep WATCH_SECONDS
    end
when "on"
    minutes = ARGV[1] && minutes_arg(ARGV[1])
    STORE.transaction { |state| state["enabled"] = true; state["minutes"] = minutes if minutes }
    status
when "off"
    STORE.transaction { |state| Playtesting.control(state, "off") }
    status
when "start"
    STORE.transaction { |state| Playtesting.control(state, "start") }
    status
when "code"
    code = STORE.transaction do |state|
        ARGV[1].to_s.start_with?("neu") || ARGV[1] == "new" ? Playtesting.control(state, "new_code") : Playtesting.ensure_code(state)
        state["code"]
    end
    puts "Klassencode: #{c(code, :bold, :yellow)}"
    puts c("Nur wer ihn im Tab Playtesting eingibt, macht mit (wer im Team eines eingereichten Spiels ist, braucht keinen).", :dim)
when "stop"
    STORE.transaction { |state| Playtesting.control(state, "stop") }
    status
when "minutes"
    minutes = minutes_arg(ARGV[1])
    STORE.transaction { |state| state["minutes"] = minutes }
    status
when "games"
    state = STORE.read
    games = state["submissions"].values.sort_by { |s| s["submitted_at"].to_s }
    puts c("Noch kein Spiel eingereicht.", :dim) if games.empty?
    games.each do |s|
        feedback = Playtesting.feedback_of(state, s["id"])
        broken = feedback.count { |a| a["answers"]["broken"] }
        fun = Playtesting.fun_average(state, s["id"])
        versions = "#{s['tags'].size} #{s['tags'].size == 1 ? 'Version' : 'Versionen'}"
        if s["withdrawn"]
            puts c("#{s['id']}  #{feedback.size.to_s.rjust(2)} Tests  #{game_name(s['title'], s['author'])}  (#{s['tag']}, #{versions})  HERAUSGENOMMEN", :dim)
            next
        end
        line = "#{c(s['id'], :yellow, :bold)}  #{c(feedback.size.to_s.rjust(2), :bold)} Tests  Spaß #{fun ? number(fun) : ' – '}  #{c(game_name(s['title'], s['author']), :bold)}  #{c("(#{s['tag']}, #{versions})", :dim)}"
        line += "  #{c("#{broken}× nicht spielbar", :red, :bold)}" if broken > 0
        puts line
    end
    first = games.find { |s| !s["withdrawn"] }
    next_steps(["./playtest.rb testers", "wer wie viele Spiele getestet hat"],
               (["./playtest.rb remove #{first['id']}", "ein Spiel aus der Runde nehmen (Kennung von oben)"] if first),
               ["./playtest.rb pdf", "die Rückmeldungen zum Drucken"])
when "testers"
    state = STORE.read
    counts = Hash.new { |h, k| h[k] = [0, 0] }
    state["assignments"].values.each do |a|
        counts[a["name"].to_s][a["finished_at"] ? 0 : 1] += 1
    end
    puts c("Noch niemand hat getestet.", :dim) if counts.empty?
    width = counts.keys.map { |name| name.empty? ? 12 : name.size }.max.to_i
    counts.sort_by { |name, (done, _)| [-done, name.downcase] }.each do |name, (done, open)|
        puts "#{c((name.empty? ? '(ohne Namen)' : name).ljust(width), :cyan)}  #{c(done, :bold)} fertig#{open > 0 ? c(", #{open} offen", :yellow) : ''}"
    end
    next_steps(["./playtest.rb", "die Übersicht der Runde"])
when "remove"
    STORE.transaction do |state|
        s = find_submission(state, ARGV[1])
        s["withdrawn"] = true
        puts "#{c(game_name(s['title'], s['author']), :bold)} wird nicht mehr zum Testen verteilt (die Rückmeldungen bleiben)."
    end
    next_steps(["./playtest.rb games", "die Spiele der Runde"])
when "pdf"
    begin
        require_relative "playtest_pdf"
    rescue LoadError => e
        fail_with "Prawn fehlt (#{e.message}). Den Ruby-Container neu bauen: ./config.rb build ruby"
    end
    source = ARGV[1..].find { |a| a.end_with?(".json") }
    state = source ? JSON.parse(File.read(File.expand_path(source, DIR))) : STORE.read
    stamp = Time.now.strftime("%Y-%m-%d-%H%M")
    path = ARGV[1..].find { |a| a.end_with?(".pdf") } || File.join(DIR, "rueckmeldungen-#{stamp}.pdf")
    path = File.expand_path(path, DIR)
    PlaytestPDF.render(state, path, static: ENV["STATIC_PATH"] || "/static", gen: ENV["GEN_PATH"] || "/gen",
                       games: File.join(ENV["GEN_PATH"] || "/gen", "games"))
    puts "#{c('Geschrieben:', :green)} #{path}"
    puts c("(auf dem Server: data/raw/playtesting/#{File.basename(path)})", :dim) if path.start_with?("/raw/playtesting/")
    next_steps((["./playtest.rb reset", "eine neue Runde (diese kommt ins Archiv)"] unless source))
when "reset"
    STORE.reset
    puts "#{c('Eine neue Runde beginnt.', :green)} Die alte liegt in #{File.join(DIR, 'archive')} (drucken: ./playtest.rb pdf archive/<datei>.json)."
    puts
    status
else
    puts File.read(__FILE__, encoding: "UTF-8").lines.drop(1).take_while { |l| l.start_with?("#") }.map { |l| l.sub(/^# ?/, "") }.join
    exit 1
end
