// Launch at startup with admin rights, using a Task Scheduler task.
// (The normal "startup apps" list can't start admin apps without a UAC prompt.)
const { app } = require("electron");
const { execFile } = require("child_process");

const TASK = "NekoTun";

// Paths are passed in environment variables, never pasted into the script,
// so odd characters in a path can't change what PowerShell runs.
const ENABLE_PS = `
$a = New-ScheduledTaskAction -Execute $env:NEKO_EXE -Argument $env:NEKO_ARGS
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName '${TASK}' -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null
`;
const DISABLE_PS = `Unregister-ScheduledTask -TaskName '${TASK}' -Confirm:$false -ErrorAction SilentlyContinue`;
const QUERY_PS = `if (Get-ScheduledTask -TaskName '${TASK}' -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`;

function ps(script, env = {}) {
  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, env: { ...process.env, ...env } },
      (err, stdout, stderr) => resolve({ ok: !err, out: (stdout + stderr).trim() }),
    );
  });
}

// What the task should run: the packaged .exe, or (while developing) electron.exe + this folder
function command() {
  if (app.isPackaged) return { exe: process.execPath, args: "--hidden" };
  return { exe: process.execPath, args: `"${app.getAppPath()}" --hidden` };
}

async function isEnabled() {
  const r = await ps(QUERY_PS);
  return r.ok && r.out === "yes";
}

async function setEnabled(on) {
  if (on) {
    const { exe, args } = command();
    const r = await ps(ENABLE_PS, { NEKO_EXE: exe, NEKO_ARGS: args });
    if (!r.ok) return { ok: false, error: /denied/i.test(r.out) ? "Needs admin — start NekoTun as administrator" : r.out };
  } else {
    await ps(DISABLE_PS);
  }
  return { ok: true, enabled: await isEnabled() };
}

module.exports = { isEnabled, setEnabled };
