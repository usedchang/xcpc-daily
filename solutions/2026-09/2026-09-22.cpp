#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct LB{
    vector<ll>a;
    LB(){
        a.resize(62);
    }
    void insert(ll x){
        for(int j=61;j>=0;j--){
            if(x>>j&1){
                if(a[j]) x^=a[j];
                else {
                    a[j]=x;
                    break;
                }
            }
        }
    }
    void init(){
        for(int j=0;j<=61;j++){
            if(a[j]){
                for(int k=j+1;k<=61;k++) if(a[k]>>j&1) a[k]^=a[j];
            }
        }
    }//约简线性基
    ll qrymx(ll x) {
        for(int j=61;j>=0;j--){
            if((a[j]^x)>x) x^=a[j];
        }
        return x;
    } 
};//线性基模板
void solve(){
    int n,m;
    cin>>n>>m;
    vector<vector<pair<int,ll>>>G(n+1);
    for(int i=1;i<=m;i++){
        int x,y;ll w;
        cin>>x>>y>>w;
        G[x].emplace_back(y,w);
        G[y].emplace_back(x,w);
    }
    vector<int>vis(n+1);
    vector<ll>a(n+1);
    LB lb;//线性基
    auto dfs=[&](auto &&dfs,int u,int fa) ->void {
        vis[u]=1;
        for(auto& [v,w]:G[u]){
            if(v==fa) continue;
            if(!vis[v]) {
                a[v]=a[u]^w;
                dfs(dfs,v,u);
            }
            else{
                lb.insert(a[u]^a[v]^w);
            }//构成一条返祖边
        }
    };
    for(int i=1;i<=n;i++){
        if(!vis[i]) dfs(dfs,i,0);
    }
    ll S=0;
    for(int i=0;i<=61;i++) S^=lb.a[i];
    lb.init();//在本题没用
    cout<<lb.qrymx(a[1]^a[n])<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    solve();
    return 0;
}