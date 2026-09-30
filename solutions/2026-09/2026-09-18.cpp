#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
struct node{
    int x,y;ll w;
    node(int x,int y,ll w):x(x),y(y),w(w){};
    node(){};
    friend bool operator<(node A,node B){
        return A.w>B.w;
    }
};
void solve(){
    int n,s1,s2;
    cin>>n>>s1>>s2;
    vector<vector<int>>G(n+1),T(n+1);
    int m,x,y;
    cin>>m;
    for(int i=1;i<=m;i++){
        cin>>x>>y;
        G[x].emplace_back(y);
        G[y].emplace_back(x);
    }
    cin>>m;
    for(int i=1;i<=m;i++){
        cin>>x>>y;
        T[x].emplace_back(y);
        T[y].emplace_back(x);
    }
    priority_queue<node>Q;
    vector<vector<ll>>dis(n+1,vector<ll>(n+1,INF));
    Q.emplace(s1,s2,0LL);
    dis[s1][s2]=0;
    ll ans=INF;
    while(!Q.empty()){
        auto [x,y,w]=Q.top();
        Q.pop();
        for(int u1:G[x]){
            for(int u2:T[y]){
                if(x==y&&u1==u2) ans=min(ans,dis[x][y]);
                if(dis[u1][u2]>dis[x][y]+abs(u1-u2)){
                    dis[u1][u2]=dis[x][y]+abs(u1-u2);
                    Q.emplace(u1,u2,dis[u1][u2]);
                }
            }
        }
    }
    if(ans==INF) cout<<-1<<endl;
    else cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}
