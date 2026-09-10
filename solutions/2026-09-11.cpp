#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e9;
// struct DSU{
//     vector<int>f;
//     DSU(int n){
//         f.resize(n+1);
//         iota(f.begin(),f.end(),0);
//     }
//     int find(int x){return x==f[x]?x:f[x]=find(f[x]);}
//     bool merge(int x,int y){
//         int fx=find(x),fy=find(y);
//         if(fx==fy) return false;
//         f[fx]=fy;
//         return true;
//     }
// };
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n;string s;
    cin>>n>>s;
    s="&"+s;
    string t="&spbsu";
    vector<vector<ll>>p(n+2,vector<ll>(7,INF));
    vector<vector<ll>>pre(n+2,vector<ll>(7,INF));
    vector<vector<ll>>suf(n+2,vector<ll>(7,INF));
    for(int i=1;i<=n;i++)  for(int j=1;j<=5;j++) if(s[i]==t[j]) p[i][j]=0;
    for(int i=1;i<=n;i++){
        for(int j=1;j<=5;j++) pre[i][j]=min(p[i][j],pre[i-1][j]+1);
    }
    for(int i=n;i>=1;i--){
        for(int j=1;j<=5;j++) suf[i][j]=min(p[i][j],suf[i+1][j]+1);
    }
    /*
    sbpsu
    */
    ll ans=INF;
    auto f=[&](int l,int r) ->ll {
        ll s=INF;
        ll suml=0;
        for(int i=l;i<=r+1;i++){
            ll sumr=0;
            for(int j=i;j<=r;j++) sumr+=suf[j][j-l+1];
            s=min(s,suml+sumr);
            suml+=pre[i][i-l+1];
        }
        return s;
    };
    for(int l=1;l+5-1<=n;l++){
        int r=l+5-1;
        ans=min(ans,f(l,r));
    }
    cout<<ans<<endl;
    return 0;
}