#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,w,k;
    cin>>n>>w>>k;
    vector<pair<ll,ll>>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i].first>>a[i].second;//代价，美丽度
    sort(a.begin()+1,a.end());
    vector<ll>dp(w+1);
    ll ans=0;
    for(int i=0;i<=n;i++){
        ll res=0;
        for(int j=w;j>=a[i].first;j--) dp[j]=max(dp[j],dp[j-a[i].first]+a[i].second);//这部分dp
        vector<ll>tmp;
        for(int j=i+1;j<=n;j++) tmp.emplace_back(a[j].second);
        sort(tmp.begin(),tmp.end());
        res=dp[w];
        for(int j=(int)tmp.size()-1;j>=max((int)tmp.size()-k,0);j--) res+=tmp[j];
        ans=max(ans,res);
    }//0位置表示一次都不进行背包,全使用豁免购买
    cout<<ans<<endl;
    return 0;
}