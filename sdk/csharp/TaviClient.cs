using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace Tavi;
public sealed class TaviClient : IDisposable {
  private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(12) };
  private readonly string endpoint;
  public string Token { get; private set; }
  public TaviClient(string origin, string token = "tavi_guest_v1") {
    var uri = new Uri(origin, UriKind.Absolute);
    if (!string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) ||
      (uri.Scheme != "https" && !(uri.Scheme == "http" && new[]{"localhost","127.0.0.1","::1","10.0.2.2"}.Contains(uri.Host))))
      throw new ArgumentException("Use a HTTPS server origin", nameof(origin));
    endpoint = uri.GetLeftPart(UriPartial.Authority) + "/looprd/looprd-social/v1/social"; Token=token;
  }
  public async Task<JsonNode> CommandAsync(string op, IDictionary<string,object?>? fields = null, CancellationToken ct = default) {
    var payload = new Dictionary<string,object?> { ["op"] = op };
    if (fields != null) foreach(var item in fields) { if(item.Key is "op" or "token") throw new ArgumentException("Reserved field"); payload[item.Key]=item.Value; }
    if(Token != "tavi_guest_v1") payload["token"]=Token;
    using var req = new HttpRequestMessage(HttpMethod.Post, endpoint) {Content = JsonContent.Create(payload)};
    req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + Token);
    using var resp = await http.SendAsync(req,ct);
    resp.EnsureSuccessStatusCode();
    var result = await resp.Content.ReadFromJsonAsync<JsonNode>(cancellationToken:ct) ?? throw new InvalidOperationException("Empty Tavi response");
    if(result["ok"]?.GetValue<bool>() != true) throw new InvalidOperationException("Tavi operation failed");
    return result;
  }
  public async Task LoginAsync(string username,string password,CancellationToken ct=default) {
    var result=await CommandAsync("login",new Dictionary<string,object?>{{"username",username},{"password",password}},ct);
    Token=result["token"]?.GetValue<string>() ?? throw new InvalidOperationException("Missing session");
  }
  public Task<JsonNode> MeAsync(CancellationToken ct=default)=>CommandAsync("me",ct:ct);
  public Task<JsonNode> ContactsAsync(CancellationToken ct=default)=>CommandAsync("contact_list",ct:ct);
  public Task<JsonNode> DirectSendAsync(string peer,string text,CancellationToken ct=default)=>CommandAsync("dm_send",new Dictionary<string,object?>{{"peer",peer},{"text",text}},ct);
  public void Dispose()=>http.Dispose();
}
