# Colours for the teacher's terminal scripts (errors.rb, playtest.rb, moderate.rb), only
# where they are seen: a file (errors.rb game > spiel.json) or a pipe stays
# plain. NO_COLOR switches them off, FORCE_COLOR on (https://no-color.org),
# e.g. for "… | less -R".
module TerminalColors
    STYLES = { bold: 1, dim: 2, underline: 4, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36 }

    def self.enabled?(io, env = ENV)
        return false if env["NO_COLOR"].to_s != ""
        return true if env["FORCE_COLOR"].to_s != "" && env["FORCE_COLOR"] != "0"
        io.respond_to?(:tty?) && io.tty?
    end

    def self.paint(text, styles, enabled)
        return text.to_s if !enabled || styles.empty?
        "\e[#{styles.map { |s| STYLES.fetch(s) }.join(';')}m#{text}\e[0m"
    end

    # The text as it takes room on screen (for lining up coloured columns).
    def self.plain(text)
        text.to_s.gsub(/\e\[[\d;]*m/, "")
    end

    # c("…", :bold, :red) for standard output, ce(…) for messages on stderr,
    # fail_with(…) ends the script with a red message.
    module Helpers
        OUT = TerminalColors.enabled?($stdout)
        ERR = TerminalColors.enabled?($stderr)

        def c(text, *styles) = TerminalColors.paint(text, styles, OUT)
        def ce(text, *styles) = TerminalColors.paint(text, styles, ERR)
        def fail_with(message) = abort(ce(message, :red))

        # What one would type next, at the end of a command's output:
        # next_steps(["./errors.rb list 7", "die letzten sieben Tage"], …).
        # Goes to stderr when stdout is a file (errors.rb game > spiel.json).
        def next_steps(*steps, io: $stdout)
            steps = steps.compact
            return if steps.empty?
            paint = io == $stderr ? method(:ce) : method(:c)
            width = steps.map { |command, _| command.size }.max
            io.puts
            steps.each_with_index do |(command, what), i|
                io.puts "#{paint.call(i.zero? ? 'Weiter:' : '', :dim).then { |l| l + ' ' * (8 - TerminalColors.plain(l).size) }}#{paint.call(command.ljust(width), :cyan)}  #{paint.call(what, :dim)}"
            end
        end
    end
end
