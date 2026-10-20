#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
struct Edge{
    int x,y;ll w;
    friend bool operator<(Edge A,Edge B){
        return A.w<B.w;
    }
};
struct DSU{
    vector<ll>f;
    DSU(int n){
        f.resize(n+1);
        iota(f.begin(),f.end(),0);
    }
    int find(int x){
        return f[x]==x?x:f[x]=find(f[x]);
    }
    bool merge(int x,int y){
        int fx=find(x),fy=find(y);
        if(fx==fy) return false;
        f[fx]=fy;
        return true;
    }
    bool same(int x,int y){return find(x)==find(y);}
};
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,m;
    cin>>n>>m;
    vector<vector<int>>G(2*n);
    vector<Edge>edge;
    edge.reserve(m);
    for(int i=1;i<=m;i++){
        int x,y;ll w;
        cin>>x>>y>>w;
        edge.push_back({x,y,w});
    }
    sort(edge.begin(),edge.end());
    vector<ll>val(n*2);
    DSU dsu(n*2);
    int tot=n;
    for(auto &[x,y,w]:edge){
        int fx=dsu.find(x),fy=dsu.find(y);
        if(fx!=fy){
            ++tot;
            dsu.merge(fx,tot);
            dsu.merge(fy,tot);
            G[tot].emplace_back(fx);
            G[tot].emplace_back(fy);
            val[tot]=w;
        }
    }
    vector<int>dfn(n*2),d(n*2);
    vector<array<int,20>>st(n*2);
    int nums=0;
    auto dfs=[&](auto &&dfs,int u,int fa) ->void {
        dfn[u]=++nums;
        d[u]=d[fa]+1;
        st[dfn[u]][0]=fa;
        for(int v:G[u]) {
            if(v==fa) continue;
            dfs(dfs,v,u);
        }
    };
    dfs(dfs,tot,0);
    for(int i=1;i<=19;i++){
        for(int j=1;j+(1<<i)-1<=nums;j++){
            int L=st[j][i-1],R=st[j+(1<<i-1)][i-1];
            st[j][i]=d[L]<d[R]?L:R;
        }
    }
    auto lca=[&](int l,int r) ->int {
        if(l==r) return l;
        l=dfn[l],r=dfn[r];
        if(l>r) swap(l,r);
        ++l;
        int len=__lg(r-l+1);
        int L=st[l][len],R=st[r-(1<<len)+1][len];
        return d[L]<d[R]?L:R;
    };
    ll ans=INF;
    for(auto &[x,y,w]:edge){
        ll v1=val[lca(1,x)];
        ll v2=val[lca(y,n)];
        if(w>=max(v1,v2)) ans=min(ans,w+max(v1,v2));
        ll v3=val[lca(1,y)];
        ll v4=val[lca(x,n)];
        if(w>=max(v3,v4)) ans=min(ans,w+max(v3,v4));
    }
    cout<<ans<<endl;
    return 0;
}