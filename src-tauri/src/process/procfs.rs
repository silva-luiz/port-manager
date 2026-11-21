//! Parsers for Linux `/proc/<pid>/{stat,cmdline}`. Pure text processing, so
//! they are compiled and tested on every platform; only `linux.rs` reads files.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stat {
    /// Single-letter state, e.g. `R`, `S`, `Z` (zombie).
    pub state: char,
    pub ppid: u32,
    /// Clock ticks after boot when the process started; monotonic per boot.
    pub start_time: u64,
}

/// Parses `/proc/<pid>/stat`. The command name (field 2) may contain spaces
/// and parentheses, so fields are counted from the last `)`.
pub fn parse_stat(content: &str) -> Option<Stat> {
    let after_name = &content[content.rfind(')')? + 1..];
    let fields: Vec<&str> = after_name.split_whitespace().collect();
    // After the name: [0] state (field 3), [1] ppid (field 4), [19] starttime (field 22).
    Some(Stat {
        state: fields.first()?.chars().next()?,
        ppid: fields.get(1)?.parse().ok()?,
        start_time: fields.get(19)?.parse().ok()?,
    })
}

/// `/proc/<pid>/cmdline` separates arguments with NUL. Arguments containing
/// spaces are quoted so the result reads like a shell command.
pub fn cmdline_to_string(raw: &[u8]) -> String {
    raw.split(|&b| b == 0)
        .filter(|arg| !arg.is_empty())
        .map(|arg| {
            let arg = String::from_utf8_lossy(arg);
            if arg.contains(' ') {
                format!("\"{arg}\"")
            } else {
                arg.into_owned()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const STAT: &str = "4242 (node) S 4100 4242 4100 34816 4242 4194304 1234 0 0 0 52 11 0 0 20 0 11 0 987654 1167360000 12345 18446744073709551615 0 0 0 0 0 0 0 4096 16386 0 0 0 17 3 0 0 0 0 0";

    #[test]
    fn parses_state_parent_and_start_time() {
        assert_eq!(
            parse_stat(STAT),
            Some(Stat {
                state: 'S',
                ppid: 4100,
                start_time: 987654
            })
        );
    }

    #[test]
    fn handles_names_with_spaces_and_parentheses() {
        let tricky = STAT.replace("(node)", "(my (weird) name)");
        assert_eq!(parse_stat(&tricky).map(|s| s.ppid), Some(4100));
        assert_eq!(parse_stat("garbage"), None);
        assert_eq!(parse_stat("1 (x) S"), None, "too few fields");
    }

    #[test]
    fn joins_command_line_arguments() {
        assert_eq!(
            cmdline_to_string(b"node\0node_modules/vite/bin/vite.js\0--port\x005173\0"),
            "node node_modules/vite/bin/vite.js --port 5173"
        );
        assert_eq!(
            cmdline_to_string(b"/opt/My App/app\0--flag\0"),
            "\"/opt/My App/app\" --flag"
        );
        assert_eq!(cmdline_to_string(b""), "");
    }
}
