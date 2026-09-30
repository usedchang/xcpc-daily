#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll mod=1e9+7;
const int N=1e6+5;
ll ans[N],f[N],_2[N];
void init(int n){
    vector<ll>f(n+1,1);//本原串的数量
    for(int i=1;i<=n;i++) f[i]=f[i-1]*2%mod,_2[i]=f[i];
    for(int i=1;i<=n;i++){
        for(int j=2*i;j<=n;j+=i){
            f[j]-=f[i];
            if(f[j]<0) f[j]+=mod;
        }
        ans[i]=_2[i]-f[i];
        if(ans[i]<0) ans[i]+=mod;
    }
}
void solve(){
    ll n;cin>>n;
    cout<<ans[n]<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    init(1e6);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}