#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll INF=1e18;
void solve(){
    ll n,m;
    cin>>n>>m;
    ll ans=INF,cnt=0;
    for(int x=1;x<=10000;x++){
        ll dn=(m+x-1)/x;
        if(dn<=n&&dn>0) ans=min(ans,(n-dn)+(dn-m%dn)%dn);
    }
    for(int dn=1;dn<=10000;dn++){
        ll x=m/dn;
        if(dn<=n&&dn>0) ans=min(ans,(n-dn)+(dn-m%dn)%dn);
    }
    cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}