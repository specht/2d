#!/usr/bin/env ruby
# Moderation, run by the teacher in the terminal when a game has to go for
# good (words or pictures that need no discussion). The rules: moderation.rb.
# Run it in the Ruby container, where /gen and /raw are (./config.rb exec ruby
# sh; from outside, put "./config.rb exec ruby ruby" in front instead of "./"):
#
#   ./moderate.rb search WORT …     games with one of the words, and where in
#                                   them; asks which of them to delete
#   ./moderate.rb show 3fa2b1c      one game: its texts, pictures, versions
#   ./moderate.rb delete 3fa2b1c …  delete versions (asks; --ja does not;
#                                   --mit-spaeteren: also every later version)
#   ./moderate.rb web [480]         a moderation page for 8 hours: every new
#                                   picture and text, newest first, each only
#                                   once, with the word search and deleting;
#                                   prints its secret link (Strg+C closes it)
#   ./moderate.rb log               what was deleted, when and why
#
# Words are found in every text of a game (title, author, names of sprites,
# states, levels and layers, signs, …), whatever the case or accents
# ("blod" finds "Blöd"); several words: any of them. Pictures and texts of
# the recipes and the Sprite-Katalog are safe: never shown, never deleted. Deleting removes the game
# file, its pictures and sheets where no other game uses them, its gifs, the
# database entry, playtesting submissions, and the server's game list (at
# once). Versions made from a deleted one stay and become the first of their
# own family. In a terminal the output is coloured; NO_COLOR=1 switches that off.

require "date"
require_relative "moderation"
require_relative "playtesting"
require_relative "terminal_colors"

# the container may have no locale: names and texts are UTF-8
Encoding.default_external = Encoding::UTF_8

GEN = ENV["GEN_PATH"] || "/gen"
RAW = ENV["MODERATION_PATH"] || "/raw/moderation"
PLAYTESTING = ENV["PLAYTESTING_PATH"] || "/raw/playtesting"
STATIC = ENV["STATIC_PATH"] || "/static"
DEFAULT_MINUTES = 8 * 60
MAX_MINUTES = 24 * 60

include TerminalColors::Helpers

def database
    return $database if $database
    require "neo4j_bolt"
    Neo4jBolt.bolt_host = "neo4j"
    Neo4jBolt.bolt_port = 7687
    klass = Class.new { include Neo4jBolt }
    $database = klass.new
rescue LoadError => e
    fail_with "Die Datenbank-Anbindung fehlt (#{e.message}). Bitte im Ruby-Container ausführen."
end

def saved_tags(tags)
    return Set.new if tags.empty?
    database.neo4j_query("MATCH (g:Game) WHERE g.tag IN $tags RETURN g.tag AS tag;", { :tags => tags }).map { |r| r["tag"] }.to_set
rescue StandardError => e
    warn ce("Die Datenbank ist nicht erreichbar (#{e.message}).", :yellow)
    Set.new
end

def catalog
    return $catalog if $catalog
    $catalog = Moderation::Catalog.new(GEN, cache: Moderation.cache_path(RAW), safe: Moderation.recipe_safe(STATIC))
    tty = $stderr.tty?
    $catalog.refresh do |done, total|
        next unless total > 200
        line = "Spiele lesen … #{done} von #{total} (nur beim ersten Mal, dann kennt der Zwischenspeicher sie)"
        tty ? $stderr.print("\r#{ce(line, :dim)}\e[K") : (done % 10_000 == 0 && warn(line))
    end
    $stderr.print "\r\e[K" if tty
    $catalog
end

def date(seconds) = Time.at(seconds).localtime.strftime("%d.%m.%Y %H:%M")
def plural(n, one, many) = "#{n} #{n == 1 ? one : many}"

def game_name(entry)
    title = entry.title.to_s.strip.empty? ? c("(ohne Titel)", :dim) : c("»#{entry.title}«", :bold)
    author = entry.author.to_s.strip.empty? ? "" : " von #{c(entry.author, :bold)}"
    "#{title}#{author}"
end

# "… Blöder Wald" with the word in colour (where it can be found as it is)
def mark(text, term)
    text = text.gsub(/\s+/, " ").strip
    text = "#{text[0, 117]}…" if text.size > 120
    i = Moderation.normalize(text).index(term)
    return c(text, :yellow) unless i && Moderation.normalize(text[0, i]).size == i
    text[0, i] + c(text[i, term.size], :red, :bold) + text[i + term.size..]
end

def game_line(entry, saved, later, number = nil)
    badge = saved.include?(entry.tag) ? c("gespeichert", :green) : c("nur gespielt", :dim)
    more = later.empty? ? "" : " · #{c(plural(later.size, 'spätere Version', 'spätere Versionen'), :yellow)}"
    prefix = number ? "#{c(number.to_s.rjust(3), :bold)}  " : ""
    "#{prefix}#{c(entry.tag, :cyan, :bold)}  #{game_name(entry)}  #{c("· #{date(entry.time)} ·", :dim)} #{badge}#{more}"
end

def find_tags(args)
    fail_with "Bitte einen Spielcode angeben (sieben Zeichen, z. B. aus »./moderate.rb search …«)." if args.empty?
    args.map do |arg|
        found = catalog.resolve(arg)
        fail_with "Kein Spiel #{arg}." if found.empty?
        fail_with "#{arg} passt auf mehrere Spiele (#{found.first(5).join(', ')} …), bitte genauer." if found.size > 1
        found.first
    end.uniq
end

def ask(question)
    return nil unless $stdin.tty?
    print question
    answer = $stdin.gets
    puts if answer.nil?
    answer&.strip
end

# Deletes after showing what goes; yes: without asking.
def delete_tags(tags, reason:, yes: false)
    children = catalog.children
    saved = saved_tags(tags)
    puts c("Endgültig gelöscht werden #{plural(tags.size, 'Version', 'Versionen')}:", :bold)
    tags.each { |t| puts "  #{game_line(catalog[t], saved, [])}" if catalog[t] }
    kept = tags.flat_map { |t| children[t] }.uniq - tags
    puts c("Bleiben (aus einer gelöschten Version gemacht, werden der Anfang ihrer eigenen Familie): #{kept.join(' ')}", :dim) unless kept.empty?
    unless yes
        answer = ask("Wirklich löschen? Dann »ja« tippen: ")
        fail_with "Abgebrochen (ohne Rückfrage: --ja)." if answer.nil?
        fail_with "Abgebrochen, nichts gelöscht." unless answer.downcase == "ja"
    end
    report = begin
        Moderation.delete(tags, catalog: catalog, raw: RAW, database: database,
                          playtesting: Playtesting::Store.new(PLAYTESTING), by: "Terminal", reason: reason)
    rescue StandardError => e
        fail_with "Löschen fehlgeschlagen: #{e.message} (läuft die Datenbank?). Was schon gelöscht ist, steht in ./moderate.rb log; der Befehl kann wiederholt werden."
    end
    puts c("Gelöscht: #{plural(report['tags'].size, 'Version', 'Versionen')}", :green, :bold) +
         c(" – #{plural(report['frames'], 'Bild', 'Bilder')}, #{plural(report['sheets'], 'Spritesheet', 'Spritesheets')}, " \
           "#{plural(report['gifs'], 'Gif', 'Gifs')}, #{plural(report['files'], 'Datei', 'Dateien')} insgesamt; " \
           "#{report['in_database']} aus der Datenbank.", :green)
    puts c("Playtesting: #{report['playtesting'].join(', ')} geht zur letzten verbliebenen Version zurück oder ist aus der Runde.", :yellow) unless report["playtesting"].empty?
    puts c("Die Liste »Spiel laden« zeigt sie nicht mehr. Wer das Spiel gerade offen hat, hat es bis zum Neuladen noch; Bilder können in Browsern noch etwa eine Minute im Zwischenspeicher sein.", :dim)
    report
end

def show(tag)
    entry = catalog[tag]
    game = JSON.parse(File.read(File.join(GEN, "games", "#{tag}.json")))
    later = catalog.later_versions(tag)
    saved = saved_tags([tag])
    puts game_line(entry, saved, later)
    parent = entry.parent && catalog[entry.parent] ? entry.parent : nil
    puts c("Gemacht aus #{parent}", :dim) if parent
    puts c("Spätere Versionen: #{later.join(' ')}", :dim) unless later.empty?
    novel = catalog.novelty(tag)
    puts "#{plural(entry.frames.size, 'Bild', 'Bilder')}, davon #{novel[:frames].size} zum ersten Mal in einem Spiel " +
         c("(ansehen: ./moderate.rb web)", :dim)
    puts
    fresh = novel[:texts].to_set
    Moderation.each_text(game) do |where, text|
        puts "#{c(where, :dim)}: #{fresh.include?(text) ? c(text, :yellow) : text}"
    end
    puts c("(gelb: zum ersten Mal in einem Spiel)", :dim)
    next_steps(["./moderate.rb delete #{tag}", "diese Version löschen"],
               (["./moderate.rb delete #{tag} --mit-spaeteren", later.size == 1 ? "mit der späteren Version löschen" : "mit allen #{later.size} späteren Versionen löschen"] unless later.empty?))
end

def search(words)
    terms = Moderation.terms(words)
    fail_with "Bitte ein oder mehrere Wörter angeben: ./moderate.rb search wort1 wort2 (\"zwei Wörter\" in Anführungszeichen)." if terms.empty?
    found = catalog.search(terms)
    if found.empty?
        puts c("Kein Spiel enthält #{terms.map { |t| "»#{t}«" }.join(' oder ')} (#{catalog.size} Spiele durchsucht).", :green)
        return
    end
    saved = saved_tags(found.map { |f| f[:entry].tag })
    children = catalog.children
    later = found.to_h { |f| [f[:entry].tag, catalog.later_versions(f[:entry].tag, children)] }
    puts c("#{plural(found.size, 'Spiel enthält', 'Spiele enthalten')} #{terms.map { |t| "»#{t}«" }.join(' oder ')} (von #{catalog.size}):", :bold)
    found.each_with_index do |f, i|
        puts
        puts game_line(f[:entry], saved, later[f[:entry].tag], i + 1)
        f[:hits].each { |hit| puts "       #{c(hit[:where], :dim)}: #{mark(hit[:text], hit[:term])}" }
        puts c("       … und mehr", :dim) if f[:hits].size >= Moderation::MAX_HITS_PER_GAME
    end
    puts
    answer = ask("Löschen? Nummern (z. B. »1 3«) oder »alle«; ein + dahinter nimmt die späteren Versionen mit (»2+«, »alle+«). Enter: nichts. ")
    if answer.nil? || answer.empty?
        next_steps(["./moderate.rb show #{found.first[:entry].tag}", "ein Spiel genauer ansehen"],
                   ["./moderate.rb delete #{found.map { |f| f[:entry].tag }.first(8).join(' ')}", "löschen (fragt noch einmal)"],
                   ["./moderate.rb web", "die Bilder ansehen und dort löschen"])
        return
    end
    tags = []
    answer.downcase.split(/[\s,]+/).each do |word|
        m = /\A(alle|\d+)(\+?)\z/.match(word)
        fail_with "»#{word}« verstehe ich nicht – Nummern von 1 bis #{found.size} oder »alle«, nichts gelöscht." unless m
        picked = m[1] == "alle" ? found : [found[m[1].to_i - 1]]
        fail_with "Keine Nummer #{m[1]}, nichts gelöscht." if picked.include?(nil) || m[1] == "0"
        picked.each do |f|
            tags << f[:entry].tag
            tags.concat(later[f[:entry].tag]) if m[2] == "+"
        end
    end
    delete_tags(tags.uniq, reason: "Suche: #{terms.join(', ')}")
end

def web(minutes)
    $stdout.sync = true
    # the page needs every game: read here first (with the progress), the
    # server then takes them from the cache in a few seconds
    catalog
    session = Moderation::Session.start(RAW, minutes)
    root = Moderation.web_root(RAW)
    link = "#{root}/moderation/#{session['token']}"
    expires = Time.at(session["expires_at"]).localtime
    until_time = expires.strftime(expires.to_date == Date.today ? "%H:%M" : "%d.%m. %H:%M")
    duration = minutes % 60 == 0 ? plural(minutes / 60, "Stunde", "Stunden") : "#{minutes} Minuten"
    puts "Die Moderationsseite ist bis #{c(until_time, :bold)} offen (#{duration}):"
    puts
    puts "  #{c(link, :cyan, :bold)}"
    puts
    puts c("Vor den Link gehört noch die Adresse des Studios (WEB_ROOT in env.rb; ./config.rb schreibt sie bei jedem Aufruf nach #{RAW}).", :yellow) if root.empty?
    puts c("Der Link ist geheim: wer ihn hat, kann Spiele löschen. Strg+C schließt die Seite sofort.", :dim)
    stop = -> { Moderation::Session.stop(RAW, session["token"]) }
    %w(INT TERM HUP).each { |signal| trap(signal) { stop.call; puts; puts "Die Moderationsseite ist geschlossen."; exit } }
    offset = File.size?(Moderation.log_path(RAW)) || 0
    while Time.now.to_i < session["expires_at"]
        sleep 2
        break unless Moderation::Session.current(RAW)&.dig("token") == session["token"]
        path = Moderation.log_path(RAW)
        next unless (File.size?(path) || 0) > offset
        File.open(path) do |f|
            f.seek(offset)
            f.each_line do |line|
                entry = JSON.parse(line) rescue next
                names = entry["games"].map { |g| "#{g['tag']} »#{g['title']}«" }.join(", ")
                puts "#{Time.now.strftime('%H:%M')} #{c('gelöscht', :red, :bold)} (#{entry['by']}): #{names}"
            end
            offset = f.pos
        end
    end
    stop.call
    puts "Die Moderationsseite ist geschlossen."
end

def log
    entries = Moderation.log(RAW)
    puts c("Noch nichts gelöscht.", :dim) if entries.empty?
    entries.each do |e|
        time = Time.parse(e["time"]).localtime.strftime("%d.%m.%Y %H:%M") rescue e["time"]
        names = e["games"].map { |g| "#{c(g['tag'], :cyan)} »#{g['title']}« von #{g['author']}" }.join(", ")
        reason = e["reason"] ? " – #{e['reason']}" : ""
        puts "#{c(time, :bold)} #{c("(#{e['by']}#{reason})", :dim)}: #{names}"
    end
end

# without a locale the words arrive as bytes
ARGV.map! { |arg| arg.dup.force_encoding(Encoding::UTF_8).scrub("?") }
args = ARGV.reject { |a| a.start_with?("--") }
command = args.shift || "help"
case command
when "search", "suche"
    search(args)
when "show"
    show(find_tags(args.first(1)).first)
when "delete"
    tags = find_tags(args)
    tags = catalog.with_later_versions(tags) if ARGV.include?("--mit-spaeteren")
    reason = ARGV.find { |a| a.start_with?("--grund=") }&.sub("--grund=", "")
    delete_tags(tags, reason: reason, yes: ARGV.include?("--ja"))
when "web"
    minutes = (args.first || DEFAULT_MINUTES).to_i
    fail_with "Bitte eine Zahl von Minuten angeben (1 bis #{MAX_MINUTES})." unless minutes.between?(1, MAX_MINUTES)
    web(minutes)
when "log"
    log
else
    puts File.read(__FILE__)[/^# Moderation.*?\n\n/m].gsub(/^# ?/, "")
end
