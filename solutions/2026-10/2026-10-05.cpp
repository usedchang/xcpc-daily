#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
void solve(){
    int n,k;
    cin>>n>>k;
    vector<ll>a(n+1);
    vector<pair<ll,ll>>seg;
    int las=0,len=0,mx=0;
    for(int i=1;i<=n;i++) {
        cin>>a[i];
        if(mx<a[i]){
            mx=a[i];
            len=i-las;
            seg.emplace_back(mx,len);
            las=i;
        }
    }
    seg.emplace_back(mx,n-las+1);
    vector<vector<ll>>dp(k+1,vector<ll>(k+1,-INF));//代价和为i,代价最大值为j的时候总效益
    dp[0][0]=0;
    for(auto &[mx,len]:seg){
        vector<vector<ll>>nxt=dp;
        vector<vector<ll>>pre(k+1,vector<ll>(k+1,-INF));
        for(ll s=0;s<=k;s++){
            pre[s][0]=0;
            for(int m=1;m<=mx;m++) pre[s][m]=max(pre[s][m-1],dp[s][m]+1LL*m*len);
        }
        for(int m=0;m<=mx;m++){
            for(int s=m;s<=k;s++){
                nxt[s][m]=max(nxt[s][m],pre[s-m][m]);
                nxt[s][m]=max(nxt[s][m],dp[s][m]+1LL*m*len);
            }
        }
        dp=move(nxt);
    }
    ll ans=0;
    for(int s=0;s<=k;s++){
        for(int j=0;j<=s;j++) ans=max(ans,dp[s][j]);
    }
    cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}