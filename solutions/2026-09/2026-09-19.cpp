#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct node{
    int x,y,z;
    node(int x,int y,int z):x(x),y(y),z(z){};
    node():x(0),y(0),z(0){};
};
int x,y,z,n;
vector<node>q;
void solve(){
    n=max(x,y);
    while(cin>>x>>y){
        if(x==0&&y==0) break;
        cin>>z;
        q.emplace_back(x,y,z);
        n=max({n,x,y});
    }
    vector<vector<pair<int,int>>>G(n+1);
    vector<int>nxt(n+1);
    vector<int>in(n+1);
    int m=q.size();
    int s=-1;
    for(auto [x,y,id]:q){
        if(s==-1) s=min(x,y);
        G[x].emplace_back(y,id);
        G[y].emplace_back(x,id);
        ++in[x],++in[y];
    }
    for(int i=1;i<=n;i++){
        if(in[i]&1){
            cout<<"Round trip does not exist."<<endl;
            return;
        }
    }
    vector<int>res;
    vector<char>vis(m+1);
    for(int i=1;i<=n;i++) {
        sort(G[i].begin(),G[i].end(),[&](pair<int,int>&A,pair<int,int>&B){
            return A.second<B.second;
        });
    }
    auto dfs=[&](auto &&dfs,int u,int id) ->void {
        while(nxt[u]<G[u].size()){
            int v=G[u][nxt[u]].first;
            int nid=G[u][nxt[u]].second;
            nxt[u]++;//当前弧优化
            if(vis[nid]) continue;
            vis[nid]=1;
            dfs(dfs,v,nid);
        }
        if(id) res.push_back(id);
    };
    dfs(dfs,s,0);
    reverse(res.begin(),res.end());
    for(int i=0;i<res.size();i++) cout<<res[i]<<" \n"[i==res.size()-1];
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    while(cin>>x>>y){
        if(x==0&&y==0) break;
        cin>>z;
        q.emplace_back(x,y,z);
        solve();
        q.clear();
    }
    return 0;
}
