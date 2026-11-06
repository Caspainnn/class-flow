using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Launcher {
 internal static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
 internal static readonly string Data=Path.GetFullPath(Environment.GetEnvironmentVariable("DATA_DIR")??Path.Combine(Root,"data"));
 internal static readonly int Port=ReadPort();
 internal static readonly string Url="http://127.0.0.1:"+Port+"/";
 internal static readonly string Identity=Hash(Normalize(Root)+"|"+Normalize(Data));
 static int ReadPort(){int n;return int.TryParse(Environment.GetEnvironmentVariable("PORT"),out n)&&n>0&&n<65536?n:3000;}
 static string Normalize(string p){return Path.GetFullPath(p).TrimEnd('\\','/').Replace('\\','/').ToLowerInvariant();}
 static string Hash(string s){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-","").ToLowerInvariant();}
 internal static Dictionary<string,object> Request(string action,bool stop=false){
  var req=(HttpWebRequest)WebRequest.Create(Url+"api/desktop/"+action);req.Proxy=null;req.Timeout=4000;req.ReadWriteTimeout=4000;
  if(stop){req.Method="POST";req.ContentLength=0;req.Headers["X-Inclass-Desktop-Key"]=File.ReadAllText(Path.Combine(Data,".desktop-key")).Trim();}
  try{using(var response=req.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(reader.ReadToEnd());}
  catch(WebException e){if(e.Response!=null){using(var reader=new StreamReader(e.Response.GetResponseStream())){var body=reader.ReadToEnd();Dictionary<string,object> result=null;try{result=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(body);}catch{}throw new Exception(result!=null&&result.ContainsKey("error")?Convert.ToString(result["error"]):"服务尚不支持此启动器，或端口被其他程序占用。请先安全停止旧服务。");}}throw;}
 }
 internal static bool Occupied(){try{using(var c=new TcpClient()){var t=c.ConnectAsync("127.0.0.1",Port);return t.Wait(400)&&c.Connected;}}catch{return false;}}
 internal static Dictionary<string,object> Status(){var s=Request("status");if(!s.ContainsKey("identity")||Convert.ToString(s["identity"])!=Identity)throw new Exception("端口 "+Port+" 上的服务不属于当前项目或数据目录，未对其进行操作。请关闭重复副本或调整 PORT。");return s;}
 internal static void Trace(string text){try{Directory.CreateDirectory(Path.Combine(Root,"logs"));File.AppendAllText(Path.Combine(Root,"logs","launcher.log"),DateTime.Now.ToString("s")+" "+text+Environment.NewLine);}catch{}}
 internal static void Error(string text){MessageBox.Show(text,"一堂课",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
 internal static string FindNode(){var paths=new List<string>{Path.Combine(Root,"runtime","node.exe"),Path.Combine(Root,"node","node.exe")};foreach(string d in (Environment.GetEnvironmentVariable("PATH")??"").Split(Path.PathSeparator))if(d.Trim('"').Length>0)paths.Add(Path.Combine(d.Trim('"'),"node.exe"));paths.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe"));paths.Add(@"D:\Node\node.exe");return paths.Find(File.Exists);}
 [STAThread] static int Main(string[] args){
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  if(Array.IndexOf(args,"--check")>=0){try{File.WriteAllText(Path.Combine(Root,"launcher-check.json"),new JavaScriptSerializer().Serialize(Status()),Encoding.UTF8);return 0;}catch{return 1;}}
  bool created;using(var mutex=new Mutex(true,"Local\\Inclass-"+Identity+"-"+Port,out created)){
   string suffix=Identity+"-"+Port;bool stopping=Array.IndexOf(args,"--stop")>=0;
   Trace("start stop="+stopping+" primary="+created+" port="+Port);if(!created){for(int i=0;i<20;i++){try{using(var signal=EventWaitHandle.OpenExisting("Local\\Inclass-"+(stopping?"Stop-":"Open-")+suffix))signal.Set();return 0;}catch(WaitHandleCannotBeOpenedException){Thread.Sleep(100);}}Error("启动器正在准备，请稍后重试。");return 1;}
   using(var open=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\Inclass-Open-"+suffix))using(var stop=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\Inclass-Stop-"+suffix))using(var form=new TrayForm(open,stop,stopping)){Application.Run(form);}mutex.ReleaseMutex();return 0;
  }
 }
}

sealed class TrayForm:ApplicationContext {
 readonly System.Windows.Forms.Timer events=new System.Windows.Forms.Timer{Interval=250};readonly NotifyIcon tray;readonly EventWaitHandle open,stop;readonly bool stopOnly;bool ready=false,quitting=false,stopPending=false,opening=false,monitoring=false,offline=false;int ticks=0;Process server;
 public TrayForm(EventWaitHandle o,EventWaitHandle s,bool stopping){
  open=o;stop=s;stopOnly=stopping;SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
  tray=new NotifyIcon{Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath),Text="一堂课 · 正在启动",Visible=true};
  var menu=new ContextMenuStrip();menu.Items.Add("打开一堂课",null,(a,b)=>Open());menu.Items.Add("打开日志目录",null,(a,b)=>{Directory.CreateDirectory(Path.Combine(Launcher.Root,"logs"));Process.Start("explorer.exe","\""+Path.Combine(Launcher.Root,"logs")+"\"");});menu.Items.Add(new ToolStripSeparator());menu.Items.Add("退出一堂课",null,(a,b)=>Quit());tray.ContextMenuStrip=menu;tray.DoubleClick+=(a,b)=>Open();bool started=false;events.Tick+=(a,b)=>{if(!started){started=true;Start();return;}if(open.WaitOne(0))Open();if(stop.WaitOne(0))Quit();if(++ticks%40==0)Monitor();};events.Start();
 }
 async void Start(){
  try{if(stopOnly&&!Launcher.Occupied()){Close();return;}await Task.Run((Action)EnsureServer);ready=true;Launcher.Trace("ready");tray.Text="一堂课 · 运行中";if(stopOnly||stopPending){Quit();return;}Open();tray.ShowBalloonTip(3500,"一堂课已启动","关闭网页后仍在后台运行，可在此处打开平台或退出。",ToolTipIcon.Info);}
  catch(Exception ex){Launcher.Error(ex.Message+"\n\n日志目录："+Path.Combine(Launcher.Root,"logs"));Close();}
 }
 void EnsureServer(){
  if(Launcher.Occupied()){try{Launcher.Status();return;}catch(WebException){throw new Exception("端口 "+Launcher.Port+" 已被占用，或旧版服务尚未更新。请先安全停止原服务再启动一堂课。");}}
  string node=Launcher.FindNode(),js=Path.Combine(Launcher.Root,"server","server.js");if(node==null)throw new Exception("未找到 Node.js。请使用完整发行包，或安装 Node.js 20 及以上版本。");if(!File.Exists(js)||!Directory.Exists(Path.Combine(Launcher.Root,"server","node_modules")))throw new Exception("程序文件或基础依赖不完整，请重新解压完整发行包。不要单独移动一堂课.exe。");
  var version=new ProcessStartInfo(node,"--version"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true};using(var p=Process.Start(version)){if(!p.WaitForExit(4000)){p.Kill();throw new Exception("无法检测 Node.js 版本。");}int major;string value=p.StandardOutput.ReadToEnd().Trim().TrimStart('v').Split('.')[0];if(p.ExitCode!=0||!int.TryParse(value,out major)||major<20)throw new Exception("需要 Node.js 20 或以上版本。");}
  Directory.CreateDirectory(Launcher.Data);string probe=Path.Combine(Launcher.Data,".launcher-write-"+Guid.NewGuid().ToString("N"));File.WriteAllText(probe,"");File.Delete(probe);
  string helper=Path.Combine(Launcher.Root,"server","desktop-start.ps1"),logs=Path.Combine(Launcher.Root,"logs");
  var info=new ProcessStartInfo("powershell.exe","-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+helper+"\" -NodePath \""+node+"\" -ServerPath \""+js+"\" -DataPath \""+Launcher.Data+"\" -ServerPort "+Launcher.Port+" -LogDir \""+logs+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
  var names=new List<string>();foreach(string key in info.EnvironmentVariables.Keys)names.Add(key);foreach(string key in names)if(key.StartsWith("CODEBUDDY_")||key=="NODE_OPTIONS")info.EnvironmentVariables.Remove(key);
  using(var start=Process.Start(info)){var outputTask=start.StandardOutput.ReadToEndAsync();var errorTask=start.StandardError.ReadToEndAsync();if(!start.WaitForExit(30000)){start.Kill();throw new Exception("后台启动等待超时，请查看日志。");}string output=outputTask.Result,error=errorTask.Result;int pid;if(start.ExitCode!=0||!int.TryParse(output.Trim(),out pid))throw new Exception("后台服务未能启动："+error);server=Process.GetProcessById(pid);}
  for(int i=0;i<120;i++){if(server.HasExited)throw new Exception("服务启动失败，请查看日志；教学数据保留。");try{Launcher.Status();return;}catch(WebException){}Thread.Sleep(250);}throw new Exception("服务启动等待超时，请查看日志后重试。");
 }
 async void Monitor(){if(!ready||quitting||opening||monitoring)return;monitoring=true;try{await Task.Run(()=>Launcher.Status());offline=false;tray.Text="一堂课 · 运行中";}catch{tray.Text="一堂课 · 服务暂时离线";if(!offline)tray.ShowBalloonTip(4000,"一堂课服务暂时离线","可双击托盘重新打开。备份恢复期间请等待服务恢复。",ToolTipIcon.Warning);offline=true;}finally{monitoring=false;}}
 async void Open(){if(!ready||quitting||opening)return;opening=true;try{if(!Launcher.Occupied()){string pending=Path.Combine(Path.GetDirectoryName(Launcher.Data),".inclass-backups-"+Path.GetFileName(Launcher.Data),"pending-restore.json");if(File.Exists(pending)){var state=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(pending));if(Convert.ToString(state["phase"])!="committed")throw new Exception("备份恢复尚未结束，请等待恢复进程完成后再打开。");}}await Task.Run((Action)EnsureServer);offline=false;tray.Text="一堂课 · 运行中";Process.Start(new ProcessStartInfo(Launcher.Url){UseShellExecute=true});}catch(Exception e){Launcher.Error("无法打开平台："+e.Message);}finally{opening=false;}}
 bool ConfirmExit(){using(var dialog=new Form{Text="退出一堂课？",ClientSize=new Size(430,150),FormBorderStyle=FormBorderStyle.FixedDialog,StartPosition=FormStartPosition.CenterScreen,MinimizeBox=false,MaximizeBox=false,TopMost=true}){var label=new Label{Text="退出后后台服务将停止，学生暂时无法连接。\n已保存的课程、课件和记录会保留。",Location=new Point(20,20),Size=new Size(395,55)};var keep=new Button{Text="保持运行",DialogResult=DialogResult.Cancel,Location=new Point(195,100),Size=new Size(95,30)};var quit=new Button{Text="退出一堂课",DialogResult=DialogResult.OK,Location=new Point(300,100),Size=new Size(110,30),FlatStyle=FlatStyle.Flat,ForeColor=Color.FromArgb(180,35,24),BackColor=Color.White};quit.FlatAppearance.BorderColor=Color.FromArgb(217,45,32);dialog.Controls.AddRange(new Control[]{label,keep,quit});dialog.AcceptButton=keep;dialog.CancelButton=keep;dialog.Shown+=(a,b)=>keep.Focus();return dialog.ShowDialog()==DialogResult.OK;}}
 async void Quit(){Launcher.Trace("quit ready="+ready);if(!ready){stopPending=true;return;}if(quitting)return;quitting=true;try{if(!Launcher.Occupied()){if(ConfirmExit())Close();return;}var s=await Task.Run(()=>Launcher.Status());var busy=new List<string>();foreach(var item in (System.Collections.IEnumerable)s["busy"])busy.Add(Convert.ToString(item));if(busy.Count>0){Launcher.Error(string.Join("；",busy.ToArray())+"。\n请先结束相关任务，平台继续运行。");return;}Launcher.Trace("show exit confirmation");if(!ConfirmExit())return;await Task.Run(()=>Launcher.Request("stop",true));Close();}catch(Exception e){Launcher.Error("未停止平台："+e.Message);}finally{quitting=false;}}
 void Close(){events.Stop();events.Dispose();tray.Visible=false;tray.Dispose();ExitThread();}
}
