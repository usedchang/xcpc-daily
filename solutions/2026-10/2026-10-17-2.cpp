#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,k;
    cin>>n>>k;
    vector<vector<ll>>w(n+1);
    vector<int>p(n+1);
    for(int i=1;i<=n;i++){
        cin>>p[i];
        w[i].resize(p[i]+1);
        for(int j=1;j<=p[i];j++) cin>>w[i][j];
    }
    auto add=[&](vector<ll>&dp,int i){
        for(int j=k;j>=p[i];j--) {
            if(dp[j-p[i]]==-INF) continue;
            dp[j]=max(dp[j],dp[j-p[i]]+w[i][p[i]]);
        }
    };
    vector<ll>dp(k+1,-INF);
    dp[0]=0;
    ll ans=0;
    auto dfs=[&](auto &&dfs,vector<ll>cur,int l,int r) ->void {
        if(l==r){
            for(int j=k-1;j>k-p[l]&&j>=0;j--) {
                if(cur[j]==-INF) continue;
                ans=max(ans,cur[j]+w[l][k-j]);
            }
            return;
        }
        int mid=l+r>>1;
        auto L=cur,R=cur;
        for(int j=mid+1;j<=r;j++) add(L,j);
        for(int j=l;j<=mid;j++) add(R,j);
        dfs(dfs,move(L),l,mid);
        dfs(dfs,move(R),mid+1,r);
    };
    dfs(dfs,move(dp),1,n);
    vector<ll>all(k+1,-INF);
    all[0]=0;
    for(int j=1;j<=n;j++) add(all,j);
    for(int j=0;j<=k;j++) ans=max(ans,all[j]);
    cout<<ans<<endl;
    return 0;
}