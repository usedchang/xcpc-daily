#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
struct DSU{
    vector<int>f;
    DSU(int n){
        f.resize(n+1);
        iota(f.begin(),f.end(),0);
    }
    int find(int x){
        return x==f[x]?x:f[x]=find(f[x]);
    }
    bool merge(int x,int y){
        int fx=find(x),fy=find(y);
        if(fx==fy) return false;
        f[fx]=fy;
        return true;
    }
    bool same(int x,int y){return find(x)==find(y);}
};
struct edge{
    int u,v;ll w;
    edge(){};
    edge(int u,int v,ll w):u(u),v(v),w(w){};
};
void solve(){
    int n,m,q;ll v;
    cin>>n>>m>>q>>v;
    vector<edge>E;
    vector<edge>nxt;
    set<pair<ll,ll>>st;
    vector<DSU>D(60,DSU(n+1));
    edge tmp;
    for(int i=1;i<=m;i++) {
        cin>>tmp.u>>tmp.v>>tmp.w;
        E.emplace_back(tmp);
    }
    for(int j=59;j>=0;j--){
        if(v>>j&1){
            for(edge &p:E){
                if(p.w>>j&1) nxt.emplace_back(p);
            }
            E=move(nxt);
        }
        else{
            for(edge &p:E){
                if(p.w>>j&1) D[j].merge(p.v,p.u);
            }
        }
    }
    DSU equ(n+1);
    for(edge &p:E) equ.merge(p.u,p.v);
    while(q--){
        int u,v;
        cin>>u>>v;
        if(equ.same(u,v)) cout<<"Yes"<<endl;
        else {
            bool f=false;
            for(int j=59;j>=0;j--){
                if(D[j].same(u,v)) {
                    f=true;
                    break;
                }
            }
            if(f) cout<<"Yes"<<endl;
            else cout<<"No"<<endl;
        }
    }
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;//cin>>T;
    while(T--) solve();
    return 0;
}