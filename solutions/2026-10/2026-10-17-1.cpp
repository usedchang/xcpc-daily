#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,k;cin>>n>>k;
    vector<ll>f(k+1,-INF);
    vector<ll>g(k+1,-INF);
    vector<ll>p(n+1);
    f[0]=0;
    vector<vector<ll>>w(n+1);
    for(int i=1;i<=n;i++){
        cin>>p[i];
        w[i].resize(p[i]+1);
        for(int j=1;j<=p[i];j++) cin>>w[i][j];
    }
    for(int i=1;i<=n;i++){
        for(int j=k;j>=1;j--){
            for(int t=p[i]-1;t>=1;t--) {
                if(j>=t&&f[j-t]!=-INF) g[j]=max(f[j-t]+w[i][t],g[j]);
            }
            if(j>=p[i]) g[j]=max(g[j-p[i]]+w[i][p[i]],g[j]);
        }
        for(int j=k;j>=p[i];j--) {
            if(f[j-p[i]]!=-INF) f[j]=max(f[j-p[i]]+w[i][p[i]],f[j]);
        }
    }
    ll ans=0;
    for(int j=0;j<=k;j++) ans=max(ans,f[j]);
    cout<<max(g[k],ans)<<endl;
    return 0;
}