#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll mod=1e9+7;
struct DSU{
    vector<int>f,siz;
    vector<ll>dis;
    DSU(int n){
        f.resize(n+1);
        dis.resize(n+1);
        siz.assign(n+1,1);
        iota(f.begin(),f.end(),0);
    }
    int find(int x){
        if(f[x]==x) return x;
        int p=f[x];
        f[x]=find(p);
        (dis[x]+=dis[p])%=2;
        return f[x];
    }
    bool merge(int x,int y,ll w){
        int fx=find(x),fy=find(y);
        if(fx==fy){
            return (dis[x]-dis[y]+2)%2==w;
        }
        f[fx]=fy;
        dis[fx]=(w+dis[y]-dis[x])%2;
        (siz[fy]+=siz[fx])%=2;
        return true;
    }
    bool same(int x,int y){
        int fx=find(x),fy=find(y);
        return find(x)==find(y);
    }
    ll Dis(int x,int y){
        find(x);
        find(y);
        return (dis[x]-dis[y]+2)%2;
    }
};
ll q_pow(ll x,ll y){
    ll s=1;
    while(y>0){
        if(y&1){
            s=s*x%mod;
        }
        y>>=1;
        x=x*x%mod;
    }
    return s;
}
void solve(){
    int n,m;cin>>n>>m;
    char c;
    vector<vector<int>>a(n+1,vector<int>(m+1));
    for(int i=1;i<=n;i++){
        for(int j=1;j<=m;j++) {
            cin>>c;
            a[i][j]=(c=='1');
        }
    }
    for(int j=1;j<=m;j++){
        ll cnt=0;
        for(int i=1;i<=n;i++){
            cnt+=a[i][j];
            cnt+=a[i][m-j+1];
        }
        if(cnt>2){
            cout<<0<<endl;
            return;
        }
    }
    DSU dsu(n+1);
    for(int j=1;j<=m;j++){
        int i1=-1,i2=-1;
        for(int i=1;i<=n;i++){
            if(a[i][j]||a[i][m-j+1]) {
                if(i1==-1) i1=i;
                else i2=i;
            } 
        }
        if(i1!=-1&&i2!=-1) {
            if(a[i1][j]!=a[i2][j]){
                if(!dsu.merge(i1,i2,0)){
                    cout<<0<<endl;
                    return;
                }//保持原状或同时翻转，差异为0
            }
            else{
                if(!dsu.merge(i1,i2,1)){
                    cout<<0<<endl;
                    return;
                }//必须选其中一个翻转，差异为1
            }
        }
    }
    ll ans=0;
    for(int i=1;i<=n;i++) if(dsu.find(i)==i) ans++;
    cout<<q_pow(2,ans)<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}