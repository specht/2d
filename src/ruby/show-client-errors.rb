#!/usr/bin/env ruby
# Summary of the studio's Fehlerberichte (client_errors.rb), grouped by
# message and place, the most frequent first, each with its latest report.
#
#   ./config.rb exec ruby ruby show-client-errors.rb          today
#   ./config.rb exec ruby ruby show-client-errors.rb 3        the last 3 days
#   ./config.rb exec ruby ruby show-client-errors.rb all      everything
#
# A report's game_tag is a temporary copy of the child's game at the moment
# of the error: open the studio with /?<game_tag> to look at it, reproduce
# the bug, and turn it into a regression test.

require "json"
require "time"

dir = ENV["CLIENT_ERRORS_PATH"] || "/raw/client-errors"
arg = ARGV.first || "1"
files = Dir[File.join(dir, "*.jsonl")].sort
files = files.last(arg.to_i.clamp(1, 10000)) unless arg == "all"
if files.empty?
    puts "Keine Fehlerberichte in #{dir}."
    exit
end

groups = {}
files.each do |path|
    File.foreach(path) do |line|
        report = JSON.parse(line) rescue next
        source = report["source"].to_s.sub(%r{^https?://[^/]+}, "").sub(/\?.*$/, "")
        key = [report["kind"] || "error", report["message"].to_s[0, 160], source, report["line"]]
        (groups[key] ||= []) << report
    end
end

groups.sort_by { |_, reports| -reports.size }.each do |(kind, message, source, line), reports|
    latest = reports.max_by { |r| r["time"].to_s }
    puts "=" * 78
    puts "#{reports.size}× [#{kind}] #{message}"
    puts "   #{source}:#{line}" unless source.empty?
    puts "   zuletzt #{latest['time']}, Version #{latest['studio_version']}, #{reports.map { |r| r['studio_version'] }.uniq.size} Version(en)"
    context = latest["context"] || {}
    puts "   Ansicht: #{context['pane']} / #{context['tool']}  #{context['url']}" unless context.empty?
    puts "   Spiel zum Nachstellen: /?#{latest['game_tag']}" if latest["game_tag"]
    unless (latest["breadcrumbs"] || []).empty?
        puts "   Zuletzt passiert:"
        latest["breadcrumbs"].last(12).each { |crumb| puts "     · #{crumb}" }
    end
    if latest["stack"]
        puts "   Stack:"
        latest["stack"].to_s.lines.first(8).each { |l| puts "     #{l.rstrip}" }
    end
end
puts "=" * 78
puts "#{groups.values.map(&:size).sum} Berichte in #{groups.size} Gruppen (#{files.map { |f| File.basename(f, '.jsonl') }.join(', ')})"
