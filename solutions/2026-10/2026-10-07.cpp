#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct SCC{
    int n;
    vector<vector<int>>g;
    vector<vector<int>>ng;
    vector<int>in;
    vector<int>dfn,low,stk,scc;
    vector<int>sz;
    vector<bool>instk;
    int idx,cnt,top;
    SCC(int n_=0){
        n=n_;
        g.assign(n+1,{});
        dfn.assign(n+1,0);
        low.assign(n+1,0);
        instk.assign(n+1,false);
        scc.assign(n+1,-1);
        stk.assign(n+1,0);
        idx=cnt=top=0;
    }
    void add(int u,int v){
        g[u].emplace_back(v);
    }
    void dfs(int u){
        dfn[u]=low[u]=(++idx);
        stk[++top]=u;
        instk[u]=true;
        for(int v:g[u]){
            if(!dfn[v]){
                dfs(v);
                low[u]=min(low[u],low[v]);
            }
            else if(instk[v]){
                low[u]=min(low[u],dfn[v]);
            }
        }
        if(low[u]==dfn[u]){
            int v;
            do{
                v=stk[top--];
                instk[v]=false;
                scc[v]=cnt;//编号从0开始
            }while(v!=u);
            cnt++;
        }
    }
    void work(){
        for(int i=1;i<=n;i++){
            if(!dfn[i]) dfs(i);
        }
        ng.assign(cnt,{});
        sz.assign(cnt,0);
        in.assign(cnt,0);
        for(int u=1;u<=n;u++){
            sz[scc[u]]++;
            for(int v:g[u]){
                if(scc[u]!=scc[v]){
                    ng[scc[u]].emplace_back(scc[v]);
                    ++in[scc[v]];
                }
            }
        }
        for(auto &e:ng){
            sort(e.begin(),e.end());
            e.erase(unique(e.begin(),e.end()),e.end());
        }
    }
};
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,m,s;
    cin>>n>>m>>s;
    SCC scc(n);
    for(int i=1;i<=m;i++){
        int x,y;cin>>x>>y;
        scc.add(x,y);
    }
    scc.work();
    int ans=0;
    for(int i=0;i<scc.cnt;i++){
        if(!scc.in[i]) ans++;
    }
    if(!scc.in[scc.scc[s]]) ans--;
    cout<<ans<<endl;
    return 0;
}