#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll N=1e6+5;
ll dp[N],cnt[N],sum[N];
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int n,q;
    cin>>n>>q;
    vector<ll>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    int p=1;
    for(int i=1;i<=a[n];i++){
        while(p+1<=n&&i>=a[p+1]) p++;
        dp[i]=i/a[p]+dp[i%a[p]];
        cnt[dp[i]]++;
    }
    for(int i=1;i<=a[n];i++) sum[i]=sum[i-1]+cnt[i];
    while(q--){
        int x;cin>>x;
        if(x>a[n]) x=a[n];
        cout<<sum[x]<<' ';
    }
    cout<<endl;
    return 0;
}